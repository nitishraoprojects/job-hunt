#!/usr/bin/env node
// Auto-apply engine. Opens each queued job's application form in Chrome, fills it from
// profile/settings.json and uploads the resume. If any required field is still empty, the
// window stays open with those fields highlighted and the run waits for you to fill them;
// answers you type are saved for future forms. Then it submits (auto mode) or waits for you
// to click submit (review mode), confirms, and moves to the next job.
//
//   node bin/apply.mjs --queue             work through status='queued' (picks up jobs queued mid-run)
//   node bin/apply.mjs --auto-queue        first queue jobs scoring >= autopilot.auto_queue_min_score
//   node bin/apply.mjs --job 42            apply to one job
//   flags: --submit / --no-submit override settings, --headless, --url <form url> (testing)
//
// Live progress: data/logs/apply-progress.json. Controls: data/logs/apply-control.json
// ({"action": "skip" | "stop" | "submit" | "applied"}), written by the dashboard.
// Never solves CAPTCHAs: a challenge is treated like an unfilled field and left to you.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openDb, log, setStatus, ROOT } from "./lib/db.mjs";
import { normQ, recall, template } from "./lib/answers.mjs";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

const db = openDb();
// --sandbox: own lock, progress file, browser profile and settings copy, for testing beside a real run.
const SANDBOX = flag("--sandbox");
const settingsPath = SANDBOX ? join(ROOT, "data", "test", "settings.sandbox.json") : join(ROOT, "profile", "settings.json");
if (SANDBOX && !existsSync(settingsPath)) writeFileSync(settingsPath, readFileSync(join(ROOT, "profile", "settings.json")));
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const A = settings.answers;
const FILE_NAME = (A.full_name || "Resume").trim().replace(/\s+/g, "_");
const autoSubmit = flag("--submit") ? true : flag("--no-submit") ? false : settings.autopilot.auto_submit;
const headless = flag("--headless") || (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY);
const WAIT_MS = (settings.autopilot.wait_for_user_minutes ?? 20) * 60_000;
const STABLE_MS = 8000; // fields must stay unchanged this long before auto-submitting what you filled
const LOGS = SANDBOX ? join(ROOT, "data", "test", "logs") : join(ROOT, "data", "logs");
const SHOTS = join(ROOT, "data", "apply-shots");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(LOGS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Single run at a time ----------------------------------------------------
// A second invocation exits; the running loop picks up newly queued jobs itself.
const LOCK = join(LOGS, "apply.lock");
if (existsSync(LOCK)) {
  const pid = Number(readFileSync(LOCK, "utf8"));
  try { process.kill(pid, 0); console.log(`Apply run ${pid} already in progress; it will pick up queued jobs.`); process.exit(0); } catch { /* stale lock */ }
}
writeFileSync(LOCK, String(process.pid));

// ---- Live progress + controls -------------------------------------------------
const PROGRESS = join(LOGS, "apply-progress.json");
const CONTROL = join(LOGS, "apply-control.json");
const progress = {
  pid: process.pid, running: true, mode: autoSubmit ? "auto" : "review", interactive: !headless,
  started_at: new Date().toISOString(), updated_at: null,
  counts: { applied: 0, failed: 0, skipped: 0, needs_input: 0 }, remaining: 0, current: null, items: [],
};
const saveProgress = () => {
  progress.updated_at = new Date().toISOString();
  writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
};
const step = (s, extra = {}) => { progress.current = { ...progress.current, step: s, ...extra }; saveProgress(); };

function takeControl() {
  if (!existsSync(CONTROL)) return null;
  try { return JSON.parse(readFileSync(CONTROL, "utf8")).action ?? null; } catch { return null; } finally { try { unlinkSync(CONTROL); } catch { /* gone */ } }
}
let stopRequested = false;

function cleanup() {
  progress.running = false;
  progress.current = null;
  saveProgress();
  try { unlinkSync(LOCK); } catch { /* gone */ }
}
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT", () => { cleanup(); process.exit(0); });

// ---- Answer matching --------------------------------------------------------
// Each rule: label regex -> answer. First match wins. Saved custom answers are checked first.
const RULES = [
  [/first\s*name|given name|forename/i, A.first_name],
  [/last\s*name|surname|family name/i, A.last_name],
  [/preferred name/i, A.first_name],
  [/^(full\s*)?name\b|your name|legal name/i, A.full_name],
  [/e-?mail/i, A.email],
  [/phone|mobile|contact number/i, A.phone],
  [/linkedin/i, A.linkedin],
  [/github/i, A.github],
  [/portfolio|website|personal site|blog/i, A.website || A.github || A.linkedin],
  [/current (company|employer|organi[sz]ation)|^company$|employer/i, A.current_company],
  [/current (title|role|designation|position)|job title/i, A.current_title],
  [/total.*experience|years of (professional )?experience|how many years/i, A.years_experience],
  [/notice period|when can you (start|join)|earliest start|availability to start/i, A.notice_period],
  [/current (ctc|salary|compensation)|present (ctc|salary)/i, A.current_ctc],
  [/expected (ctc|salary|compensation)|salary expectation|desired (salary|compensation)|compensation expectation/i, A.expected_ctc],
  [/(have you|ever)\b.*\b(worked|been employed)\b.*\b(for|at|by)\b|previously (worked|employed)|former employee/i, A.previously_worked_here || "No"],
  [/relocat/i, A.willing_to_relocate],
  [/sponsor|visa/i, A.needs_sponsorship],
  [/authori[sz]ed to work|legally (eligible|authorized|allowed)|right to work|work permit/i, A.authorized_to_work_india],
  [/how did you (hear|find|learn)|source|referr(ed|al) by|where did you/i, A.how_did_you_hear],
  [/city|location|where are you (based|located)|current address/i, `${A.city}, ${A.country}`],
  [/country/i, A.country],
  [/pronoun/i, A.pronouns],
  [/gender|sex\b/i, A.gender],
  [/race|ethnic|hispanic|latino/i, "Decline to self-identify"],
  [/veteran/i, "I am not a protected veteran"],
  [/disabilit/i, "I do not wish to answer"],
  [/education|degree|university|college|school/i, A.education],
  [/privacy|consent|agree|acknowledge|terms/i, "__CHECK__"],
];

let custom = settings.custom_answers ?? {};

// Exact remembered answer, then profile rules, then the closest similar question answered before.
// `options` (dropdown/radio choices) rules out remembered answers that don't fit this field.
function answerFor(label, { company = "", options = null } = {}) {
  const q = normQ(label);
  if (!q) return null;
  const fits = (a) => !options?.length || !!pickOption(options, a);
  const exact = custom[template(q, company)] ?? custom[q];
  if (exact && fits(exact)) return exact;
  for (const [re, ans] of RULES) if (re.test(q)) return ans || null;
  return recall(custom, q, company, { fits })?.answer ?? null;
}
const ruleAnswer = (q) => RULES.find(([re]) => re.test(q))?.[1] || null;

// ---- Form scanning ---------------------------------------------------------
function formUrl(job) {
  const u = job.apply_url || job.url;
  if (opt("--url")) return opt("--url");
  if (job.ats === "greenhouse") {
    const m = u.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/) ?? u.match(/[?&]gh_jid=(\d+)/);
    if (m && m[2]) return `https://job-boards.greenhouse.io/embed/job_app?for=${m[1]}&token=${m[2]}`;
    const slug = job.external_id?.split(":")[1];
    if (m && slug) return `https://job-boards.greenhouse.io/embed/job_app?for=${slug}&token=${m[1]}`;
  }
  if (job.ats === "lever") return u.endsWith("/apply") ? u : `${u.replace(/\/$/, "")}/apply`;
  if (job.ats === "ashby") return u.includes("/application") ? u : `${u.replace(/\/$/, "")}/application`;
  return u;
}

// Every visible control with its question label, whether it's required, and whether it's empty.
// Radios and grouped checkboxes are labelled by their group's question, not the option text.
function scan(frame) {
  return frame.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.visibility !== "hidden" && s.display !== "none" && (r.width > 0 || el.type === "file"); };
    const text = (n) => (n?.innerText ?? "").trim();
    const fieldOf = (el) => el.closest("fieldset, [role=radiogroup], [role=group], .field, .application-question, [class*=question], [class*=field], [class*=Field]");
    const labelOf = (el) => {
      if (el.type === "radio" || el.type === "checkbox") {
        const group = el.closest("fieldset, [role=radiogroup], [role=group]");
        const legend = group?.querySelector("legend") ?? (group?.getAttribute("aria-labelledby") && document.getElementById(group.getAttribute("aria-labelledby")));
        if (legend && text(legend)) return text(legend);
        if (el.type === "radio") return text(fieldOf(el)?.querySelector("label, [class*=label], [class*=Label]")) || el.name;
      }
      // Upload widgets label the input "Attach"/"Upload"; the real question is on the wrapping group.
      const GENERIC = /^(attach|upload|browse|choose( a)? file|select file|drop files? here|enter manually)$/i;
      const group = el.closest("[role=group][aria-labelledby]");
      const groupLabel = group && text(document.getElementById(group.getAttribute("aria-labelledby")));
      let byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (byFor && GENERIC.test(text(byFor))) byFor = null;
      if (el.type === "file" && groupLabel) return groupLabel;
      const aria = el.getAttribute("aria-labelledby")?.split(" ").map((id) => document.getElementById(id)?.innerText).join(" ");
      const wrap = el.closest("label");
      const fieldLabel = fieldOf(el)?.querySelector("legend, label, [class*=label], [class*=Label]")?.innerText;
      return (text(byFor) || aria || el.getAttribute("aria-label") || text(wrap) || fieldLabel || el.placeholder || el.name || "").trim().slice(0, 300);
    };
    const optionText = (el) => text(el.closest("label")) || text(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.value;
    const out = [];
    let i = 0;
    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (["hidden", "submit", "button", "image", "reset"].includes(el.type) || !vis(el) || el.disabled) continue;
      const key = `jh-${i++}`;
      el.setAttribute("data-jh", key);
      const label = labelOf(el).replace(/\s*Select\.\.\.?\s*$/i, "");
      const groupChecked = el.type === "radio" && el.name ? !!document.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`) : null;
      // Custom dropdowns (react-select etc.) keep the chosen option outside the input, inside the value container.
      const valueBox = el.getAttribute("role") === "combobox"
        ? el.closest("[class*=value-container], [class*=ValueContainer], [class*=valueContainer]") ?? el.parentElement?.parentElement
        : null;
      const comboValue = valueBox
        ? text(valueBox.querySelector("[class*=single-value], [class*=singleValue], [class*=multi-value__label], [class*=MultiValueLabel]"))
          || (valueBox.querySelector("[class*=placeholder], [class*=Placeholder]") ? "" : text(valueBox))
        : "";
      // Upload widgets often clear the <input type=file> and show the file name next to it instead.
      const uploaded = el.type === "file" && (el.files?.length > 0
        || /[\w)\]-]\.(pdf|docx?|rtf|txt|odt)\b/i.test(text(fieldOf(el)) || text(el.parentElement?.parentElement)));
      const empty = valueBox ? !comboValue && !el.value.trim()
        : el.type === "file" ? !uploaded
        : el.type === "radio" ? !groupChecked
        : el.type === "checkbox" ? !el.checked
        : el.tagName === "SELECT" ? !el.value || !el.options[el.selectedIndex]?.text.trim()
        : !el.value.trim();
      const display = comboValue ? comboValue : el.tagName === "SELECT" ? el.options[el.selectedIndex]?.text.trim()
        : el.type === "radio" ? (el.name && optionText(document.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`) ?? el)) || ""
        : el.type === "checkbox" ? (el.checked ? "Yes" : "")
        : el.type === "file" ? "" : el.value;
      out.push({
        key, tag: el.tagName.toLowerCase(), type: el.type, name: el.name, id: el.id, role: el.getAttribute("role"), label,
        option: el.type === "radio" || el.type === "checkbox" ? optionText(el) : null,
        required: el.required || el.getAttribute("aria-required") === "true" || /\*\s*$/.test(label),
        empty, display, options: el.tagName === "SELECT" ? [...el.options].map((o) => o.text.trim()) : null,
      });
    }
    return out;
  });
}

async function scanAll(page) {
  const all = [];
  for (const [fi, frame] of page.frames().entries()) {
    try { for (const c of await scan(frame)) all.push({ ...c, fi, frame }); } catch { /* cross-origin or detached */ }
  }
  return all;
}

// Required controls that are still empty, one entry per radio group.
async function missingFields(page) {
  const seen = new Set();
  return (await scanAll(page)).filter((c) => {
    if (!c.required || !c.empty) return false;
    const id = c.type === "radio" ? `${c.fi}:${c.name || c.label}` : `${c.fi}:${normQ(c.label) || c.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const pickOption = (options, answer) => {
  const a = String(answer).toLowerCase();
  return options.find((o) => o.toLowerCase() === a)
    ?? options.find((o) => o.toLowerCase().startsWith(a) || (a.startsWith(o.toLowerCase()) && o.length > 1))
    ?? options.find((o) => /decline|prefer not|don.t wish|not to answer/i.test(o) && /decline|not|wish/i.test(a))
    ?? options.find((o) => o.toLowerCase().includes(a));
};

async function fillForm(page, files, job) {
  let filled = 0;
  const radiosDone = new Set();
  const fills = new Map(); // question -> what the engine put there, to tell your edits apart later
  const list = await scanAll(page);
  const radioOptions = new Map();
  for (const c of list) if (c.type === "radio") {
    const g = `${c.fi}:${c.name || c.label}`;
    radioOptions.set(g, [...(radioOptions.get(g) ?? []), c.option ?? ""]);
  }
  for (const c of list) {
    const el = c.frame.locator(`[data-jh="${c.key}"]`);
    try {
      if (c.type === "file") {
        const what = `${c.label} ${c.name} ${c.id}`;
        const file = /cover/i.test(what) ? files.cover : /resume|\bcv\b|curriculum/i.test(what) ? files.resume : null;
        if (file && c.empty) {
          await el.setInputFiles({ name: file.name, mimeType: "application/pdf", buffer: readFileSync(file.path) });
          filled++;
        }
        continue;
      }
      if (c.tag === "textarea" && /cover letter|additional information|why .*(join|interested|us)|anything else/i.test(c.label)) {
        if (c.empty) { await el.fill(files.coverText); filled++; }
        continue;
      }
      const options = c.tag === "select" ? c.options.filter(Boolean) : c.type === "radio" ? radioOptions.get(`${c.fi}:${c.name || c.label}`) : null;
      const ans = answerFor(c.label, { company: job.company, options });
      if (!ans) continue;
      fills.set(normQ(c.label), ans);
      if (c.type === "checkbox") {
        if (ans === "__CHECK__" || /^yes$/i.test(ans) || pickOption([c.option ?? ""], ans)) { await el.check({ force: true }); filled++; }
        continue;
      }
      if (c.type === "radio") {
        const group = `${c.fi}:${c.name || c.label}`;
        if (radiosDone.has(group) || !c.empty) continue;
        if (pickOption([c.option ?? ""], ans)) { await el.check({ force: true }); filled++; radiosDone.add(group); }
        continue;
      }
      if (c.tag === "select") {
        const o = pickOption(c.options.filter(Boolean), ans);
        if (o) { await el.selectOption({ label: o }); filled++; }
        continue;
      }
      if (!c.empty || ans === "__CHECK__") continue;
      if (c.role === "combobox") {
        // Custom dropdowns (react-select etc.): open, type, take the first match.
        await el.click({ force: true });
        await page.keyboard.type(String(ans), { delay: 20 });
        await page.waitForTimeout(700);
        await page.keyboard.press("Enter");
      } else {
        await el.fill(String(ans), { force: true });
      }
      filled++;
    } catch { /* left for the user; missingFields() will report it if required */ }
  }
  return { filled, fills };
}

// Outline the empty required fields and pin a banner explaining what to do.
async function highlight(page, missing, { scroll = false } = {}) {
  const keys = new Map();
  for (const m of missing) keys.set(m.fi, [...(keys.get(m.fi) ?? []), m.key]);
  for (const [fi, frame] of page.frames().entries()) {
    await frame.evaluate(({ keys, isMain, count }) => {
      document.querySelectorAll("[data-jh-missing]").forEach((n) => { n.style.outline = ""; n.removeAttribute("data-jh-missing"); });
      for (const k of keys) {
        const el = document.querySelector(`[data-jh="${k}"]`);
        const wrapped = el && (["radio", "checkbox", "file"].includes(el.type) || el.getAttribute("role") === "combobox");
        const target = wrapped ? el.closest("fieldset, [role=radiogroup], .field, [class*=question], [class*=field], [class*=Field]") ?? el : el;
        if (target) { target.style.outline = "3px solid #f59e0b"; target.style.outlineOffset = "3px"; target.setAttribute("data-jh-missing", "1"); }
      }
      if (!isMain) return;
      let b = document.getElementById("jh-banner");
      if (!b) {
        b = document.createElement("div");
        b.id = "jh-banner";
        b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:10px 16px;font:600 14px system-ui,sans-serif;color:#111;background:#fde68a;border-bottom:1px solid #f59e0b;pointer-events:none";
        document.body.appendChild(b);
      }
      b.textContent = count
        ? `Job Hunt: ${count} field${count > 1 ? "s" : ""} need you (highlighted). Fill them here; the run continues automatically once they're done.`
        : "Job Hunt: all fields filled.";
    }, { keys: keys.get(fi) ?? [], isMain: frame === page.mainFrame(), count: missing.length }).catch(() => {});
  }
  const first = missing[0];
  if (scroll && first) await first.frame.locator(`[data-jh="${first.key}"]`).scrollIntoViewIfNeeded().catch(() => {});
}

async function captchaChallenge(page) {
  for (const f of page.frames()) {
    if (/recaptcha\/api2\/bframe|hcaptcha\.com.*challenge|challenges\.cloudflare/.test(f.url())) {
      const el = await f.frameElement().catch(() => null);
      if (el && await el.isVisible().catch(() => false)) return true;
    }
  }
  return false;
}

async function clickSubmit(page) {
  // Prefer an explicit "Submit application" button, then any visible submit control.
  const selectors = ["button:has-text('Submit application')", "button:has-text('Submit Application')", "button[type=submit]",
    "input[type=submit]", "button:has-text('Submit')", "button:has-text('Apply')"];
  for (const f of page.frames()) {
    for (const sel of selectors) {
      const all = f.locator(sel);
      const n = await all.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const btn = all.nth(i);
        if (!(await btn.isVisible().catch(() => false)) || !(await btn.isEnabled().catch(() => false))) continue;
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click();
        return true;
      }
    }
  }
  return false;
}

const CONFIRM_RE = /thank you for (applying|your application|your interest)|application (has been )?(received|submitted)|we.ve received your application|successfully submitted|thanks for applying/i;
async function isConfirmed(page) {
  for (const f of page.frames()) {
    const t = await f.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    if (CONFIRM_RE.test(t)) return true;
  }
  return false;
}

// Learn from what you chose: anything you filled that the engine left empty, or changed from
// what the engine put there. Saved with the company name generalized, so similar questions on
// later forms (at any company) fill themselves. Checkboxes are declarations and are never learned.
function learnFrom(snapshot, job, fills) {
  if (!snapshot?.length) return 0;
  const found = {};
  const seenGroup = new Set();
  for (const c of snapshot) {
    if (["file", "password", "checkbox", "hidden"].includes(c.type) || !c.display || !c.label) continue;
    if (c.type === "radio") {
      const g = `${c.fi}:${c.name || c.label}`;
      if (seenGroup.has(g)) continue;
      seenGroup.add(g);
    }
    const q = normQ(c.label);
    if (!q || q.length > 400) continue;
    const engine = fills.get(q);
    if (engine && String(engine).toLowerCase() === c.display.toLowerCase()) continue; // engine already knew
    if (!engine && ruleAnswer(q) && String(ruleAnswer(q)).toLowerCase() === c.display.toLowerCase()) continue;
    if (/^(first|last|full)?\s*name$|e-?mail|phone|^city$|address|linkedin|github|website|portfolio/.test(q)) continue; // profile basics live in Settings
    found[template(q, job.company)] = c.display.slice(0, 2000);
  }
  if (!Object.keys(found).length) return 0;
  const s = JSON.parse(readFileSync(settingsPath, "utf8"));
  s.custom_answers = { ...(s.custom_answers ?? {}), ...found };
  s.pending_questions = (s.pending_questions ?? []).filter((q) => !(q in s.custom_answers) && !recall(s.custom_answers, q, ""));
  writeFileSync(settingsPath, JSON.stringify(s, null, 2));
  custom = s.custom_answers;
  return Object.keys(found).length;
}

function recordQuestions(labels, company = "") {
  const s = JSON.parse(readFileSync(settingsPath, "utf8"));
  s.custom_answers ??= {};
  s.pending_questions = [...new Set([...(s.pending_questions ?? []), ...labels.map((l) => template(l, company))])]
    .filter((q) => q && !(q in s.custom_answers));
  writeFileSync(settingsPath, JSON.stringify(s, null, 2));
}

// Hold here until required fields are filled and stable (auto mode) or the form is submitted.
// Returns: "ready" | "submitted" | "skip" | "stop" | "applied" | "closed" | "timeout".
async function waitForUser(page, { needSubmit, reason, snap }) {
  const deadline = Date.now() + WAIT_MS;
  let lastSig = "", stableSince = Date.now(), first = true;
  await page.bringToFront().catch(() => {});
  step("waiting_for_you", { reason, waiting_since: new Date().toISOString() });
  while (Date.now() < deadline) {
    if (page.isClosed()) return "closed";
    const ctl = takeControl();
    if (ctl === "stop") { stopRequested = true; return "stop"; }
    if (ctl === "skip" || ctl === "applied") return ctl;
    if (await isConfirmed(page)) return "submitted";

    const all = await scanAll(page);
    if (all.length) snap.current = all;
    const missing = await missingFields(page);
    const captcha = await captchaChallenge(page);
    // Scroll to the first gap once; after that never move the page while you're working in it.
    await highlight(page, missing, { scroll: first });
    first = false;
    const sig = JSON.stringify(all.map((c) => [c.key, c.display, c.empty]));
    if (sig !== lastSig) { lastSig = sig; stableSince = Date.now(); }
    const left = missing.map((m) => m.label || m.name || "field");
    const readyIn = !missing.length && !captcha && !needSubmit ? Math.max(0, STABLE_MS - (Date.now() - stableSince)) : null;
    step(missing.length || captcha || needSubmit ? "waiting_for_you" : "ready_to_submit", {
      missing: captcha ? [...left, "CAPTCHA"] : left, submit_in_ms: readyIn, reason,
    });
    if (ctl === "submit") return "ready";
    if (readyIn === 0) return "ready";
    await sleep(1500);
  }
  return "timeout";
}

// ---- Per-job run -----------------------------------------------------------
function coverText(job) {
  if (job.cover_letter) {
    const md = join(ROOT, job.cover_letter.replace(/\.pdf$/, ".md"));
    if (existsSync(md)) return readFileSync(md, "utf8").replace(/\*\*/g, "").replace(/^#.*$/gm, "").trim();
  }
  // Fallback when the job has no tailored cover letter: answers.pitch from settings, wrapped in a short note.
  const pitch = A.pitch ? `${A.pitch}\n\n` : "";
  return `Hi ${job.company} team,\n\nI'm applying for the ${job.title} role.\n\n${pitch}I'd welcome the chance to talk.\n\n${A.full_name}\n${A.phone} · ${A.email}`;
}

async function applyOne(ctx, job) {
  const url = formUrl(job);
  const files = {
    resume: { path: join(ROOT, job.resume_pdf ?? "resumes/master/resume.pdf"), name: `${FILE_NAME}_Resume.pdf` },
    cover: job.cover_letter ? { path: join(ROOT, job.cover_letter), name: `${FILE_NAME}_Cover_Letter.pdf` } : null,
    coverText: coverText(job),
  };
  progress.current = { id: job.id, title: job.title, company: job.company, ats: job.ats, url, started_at: new Date().toISOString(), missing: [] };
  step("opening");
  setStatus(db, job.id, "applying", url);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const shot = (name) => page.screenshot({ path: join(SHOTS, `${job.id}-${name}.png`), fullPage: true }).catch(() => {});
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const applyBtn = page.locator("a:has-text('Apply for this job'), button:has-text('Apply for this job'), a:has-text('Apply now'), button:has-text('Apply now')").first();
    if (await applyBtn.count() && await applyBtn.isVisible().catch(() => false)) { await applyBtn.click(); await page.waitForTimeout(2500); }

    step("filling");
    const { filled, fills } = await fillForm(page, files, job);
    const snap = { current: null };
    const learn = () => {
      const n = learnFrom(snap.current, job, fills);
      if (n) log(db, "apply", `Remembered ${n} answer${n > 1 ? "s" : ""} from the ${job.company} form`);
    };
    await shot("filled");
    if (filled === 0 && !(await missingFields(page)).length) return { status: "failed", note: "No application form found on the page" };

    const asked = new Set();
    for (let attempt = 0; attempt < 4; attempt++) {
      const missing = await missingFields(page);
      missing.forEach((m) => asked.add(m.label));
      const captcha = await captchaChallenge(page);
      const needUser = missing.length > 0 || captcha || !autoSubmit;

      if (needUser) {
        if (headless) {
          recordQuestions(missing.map((m) => m.label), job.company);
          return { status: "needs_input", note: `Needs answers: ${missing.map((m) => m.label).join(" | ") || "review"}` };
        }
        const r = await waitForUser(page, {
          needSubmit: !autoSubmit, snap,
          reason: missing.length ? "missing_fields" : captcha ? "captcha" : "review",
        });
        learn();
        if (r === "submitted" || r === "applied") { await shot("submitted"); return { status: "applied", note: r === "applied" ? "Marked applied by you" : "Submitted by you" }; }
        if (r === "skip" || r === "stop" || r === "closed") return { status: "skipped", note: r === "closed" ? "Window closed" : "Skipped" };
        if (r === "timeout") { recordQuestions([...asked], job.company); return { status: "needs_input", note: `Timed out waiting for: ${(progress.current.missing ?? []).join(" | ")}` }; }
        // r === "ready": everything is filled, fall through to submit.
      }

      snap.current = await scanAll(page);
      learn();
      step("submitting", { missing: [] });
      await highlight(page, []);
      if (!(await clickSubmit(page))) return { status: "failed", note: "Submit button not found" };
      step("confirming");
      for (let i = 0; i < 20; i++) {
        if (await isConfirmed(page)) { await shot("submitted"); return { status: "applied", note: `Submitted via ${job.ats}` }; }
        await page.waitForTimeout(1000);
      }
      // No confirmation: usually the site rejected a field. Loop back and wait on whatever it flagged.
      if (!(await missingFields(page)).length && !(await captchaChallenge(page))) {
        if (headless) return { status: "failed", note: "No confirmation after submitting — check the screenshot" };
        const r = await waitForUser(page, { needSubmit: true, reason: "confirm", snap });
        learn();
        if (r === "submitted" || r === "applied") return { status: "applied", note: "Confirmed by you" };
        return { status: r === "timeout" ? "failed" : "skipped", note: "Couldn't confirm submission" };
      }
    }
    return { status: "failed", note: "Form kept rejecting the submission" };
  } catch (e) {
    return { status: "failed", note: e.message.split("\n")[0] };
  } finally {
    await page.close().catch(() => {});
  }
}

function finish(job, r) {
  const map = { applied: "applied", failed: "failed", skipped: "skipped", needs_input: "needs_input" };
  progress.counts[map[r.status]]++;
  progress.items.unshift({ id: job.id, title: job.title, company: job.company, status: r.status, note: r.note, at: new Date().toISOString() });
  progress.items = progress.items.slice(0, 50);
  if (r.status === "applied") {
    setStatus(db, job.id, "applied", r.note);
    db.prepare("UPDATE jobs SET channel = 'website', apply_error = NULL WHERE id = ?").run(job.id);
    log(db, "apply", `Applied: ${job.title} at ${job.company}`);
  } else {
    setStatus(db, job.id, r.status === "skipped" ? "saved" : "ready", r.note);
    db.prepare("UPDATE jobs SET apply_error = ? WHERE id = ?").run(r.note, job.id);
    log(db, r.status === "needs_input" ? "needs_input" : "apply", `${job.company} – ${job.title}: ${r.note}`);
  }
  saveProgress();
  console.log(`${r.status === "applied" ? "✓" : "✗"} #${job.id} ${job.company} – ${job.title}: ${r.note}`);
}

// ---- Main loop -------------------------------------------------------------
const SUPPORTED = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee", "other"];
const inList = `ats IN (${SUPPORTED.map(() => "?").join(",")})`;

if (flag("--auto-queue")) {
  const n = db.prepare(`UPDATE jobs SET status = 'queued', updated_at = datetime('now')
    WHERE status IN ('found','saved','tailored') AND fit_score >= ? AND ats IN ('greenhouse','lever','ashby')
    AND (country = 'India' OR (remote_type = 'remote' AND country = 'Worldwide'))`).run(settings.autopilot.auto_queue_min_score).changes;
  if (n) log(db, "apply", `Auto-queued ${n} jobs scoring ≥ ${settings.autopilot.auto_queue_min_score}`);
}

const tried = new Set();
const single = opt("--job") ? Number(opt("--job")) : null;
// Jobs left from a crashed run are put back in the queue.
db.prepare("UPDATE jobs SET status = 'queued' WHERE status = 'applying'").run();

function nextJob() {
  if (single) return tried.has(single) ? null : db.prepare("SELECT * FROM jobs WHERE id = ?").get(single);
  const exclude = [...tried];
  const where = `status = 'queued' AND ${inList}${exclude.length ? ` AND id NOT IN (${exclude.join(",")})` : ""}`;
  progress.remaining = db.prepare(`SELECT count(*) n FROM jobs WHERE ${where}`).get(...SUPPORTED).n;
  return db.prepare(`SELECT * FROM jobs WHERE ${where} ORDER BY fit_score DESC LIMIT 1`).get(...SUPPORTED);
}

let ctx = null;
try {
  saveProgress();
  for (let job = nextJob(); job && !stopRequested; job = nextJob()) {
    const appliedToday = db.prepare("SELECT count(*) n FROM jobs WHERE date(applied_at) = date('now')").get().n;
    if (!single && appliedToday >= settings.autopilot.daily_apply_limit) {
      log(db, "apply", `Daily limit of ${settings.autopilot.daily_apply_limit} reached; ${progress.remaining} left in queue`);
      break;
    }
    tried.add(job.id);
    progress.remaining = Math.max(0, progress.remaining - 1);
    ctx ??= await chromium.launchPersistentContext(join(ROOT, "data", SANDBOX ? "test/browser-profile" : "browser-profile"), {
      executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless, viewport: null, args: headless ? [] : ["--start-maximized"],
    });
    finish(job, await applyOne(ctx, job));
    if (takeControl() === "stop") stopRequested = true;
  }
} finally {
  if (stopRequested) log(db, "apply", "Apply run stopped by you");
  await ctx?.close().catch(() => {});
  cleanup();
}
