#!/usr/bin/env node
// jh — command line access to the job hunt database and resume renderer.
// Every automated run goes through this so the dashboard sees the same data.
//
//   jh init
//   jh add-job <file.json|->            upsert by url, prints id
//   jh update-job <id> <file.json|->    patch fields
//   jh add-outreach <file.json|->       prints id
//   jh update-outreach <id> <file.json|->
//   jh set-prep <job_id> <file.json|->  {summary, topics, questions, stories}
//   jh log <kind> <message...>
//   jh list [status]
//   jh query "<sql>"
//   jh render <file.md> [out.pdf]       markdown resume/cover letter -> PDF
import { openDb, ROOT, setStatus } from "./lib/db.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { marked } from "marked";

const DB_PATH = join(ROOT, "data", "jobhunt.db");
const open = openDb;

function readJson(arg) {
  const text = !arg || arg === "-" ? readFileSync(0, "utf8") : readFileSync(arg, "utf8");
  return JSON.parse(text);
}

const JOB_COLS = ["external_id", "posted_at", "city", "country", "remote_type", "experience", "keywords", "logo", "apply_url", "ats", "apply_error", "starred", "company", "title", "location", "url", "source", "jd", "salary", "fit_score",
  "fit_notes", "status", "channel", "resume_md", "resume_pdf", "cover_letter", "apply_notes", "applied_at"];
const OUTREACH_COLS = ["job_id", "channel", "kind", "person_name", "person_role", "company", "contact",
  "subject", "body", "status", "gmail_draft_id", "sent_at", "follow_up_on"];
const PREP_COLS = ["summary", "topics", "questions", "stories"];

const pick = (obj, cols) => Object.fromEntries(Object.entries(obj).filter(([k]) => cols.includes(k)));

function insert(db, table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
  return db.prepare(sql).run(...keys.map((k) => row[k] ?? null)).lastInsertRowid;
}

function update(db, table, id, row, touch = true) {
  const keys = Object.keys(row);
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`);
  if (touch) sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).run(...keys.map((k) => row[k] ?? null), id);
}

function log(db, kind, message) {
  db.prepare("INSERT INTO activity (kind, message) VALUES (?, ?)").run(kind, message);
}

const RESUME_CSS = `
  @page { size: A4; margin: 14mm 15mm; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10.2pt; line-height: 1.38; color: #1a1a1a; }
  h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: -0.3px; }
  h1 + p { margin: 0 0 8px; color: #444; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #bbb;
       padding-bottom: 2px; margin: 12px 0 6px; }
  h3 { font-size: 10.5pt; margin: 8px 0 1px; }
  h3 + p { margin: 0 0 3px; color: #555; font-style: italic; }
  ul { margin: 2px 0 6px; padding-left: 16px; } li { margin: 1px 0; }
  p { margin: 3px 0; } a { color: #1a1a1a; text-decoration: none; }
`;

function render(mdPath, outPath) {
  const abs = resolve(mdPath);
  const out = resolve(outPath || abs.replace(/\.md$/, ".pdf"));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${RESUME_CSS}</style></head>
    <body>${marked.parse(readFileSync(abs, "utf8"))}</body></html>`;
  const tmp = out.replace(/\.pdf$/, ".render.html");
  writeFileSync(tmp, html);
  execFileSync(process.env.CHROME_PATH ?? "google-chrome", ["--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    `--print-to-pdf=${out}`, `file://${tmp}`], { stdio: "ignore" });
  execFileSync("rm", ["-f", tmp]);
  return relative(ROOT, out);
}

const [cmd, ...args] = process.argv.slice(2);
const db = open();

switch (cmd) {
  case "init":
    console.log(`db ready at ${DB_PATH}`);
    break;
  case "add-job": {
    const job = pick(readJson(args[0]), JOB_COLS);
    const existing = job.url && db.prepare("SELECT id FROM jobs WHERE url = ?").get(job.url);
    if (existing) {
      console.log(JSON.stringify({ id: Number(existing.id), duplicate: true }));
    } else {
      const id = Number(insert(db, "jobs", job));
      log(db, "job", `Found ${job.title} at ${job.company}`);
      console.log(JSON.stringify({ id, duplicate: false }));
    }
    break;
  }
  case "update-job": {
    const patch = pick(readJson(args[1]), JOB_COLS);
    const { status, ...rest } = patch;
    update(db, "jobs", Number(args[0]), rest);
    if (status) { setStatus(db, Number(args[0]), status); log(db, "job", `Job #${args[0]} → ${status}`); }
    console.log("ok");
    break;
  }
  case "add-outreach": {
    const row = pick(readJson(args[0]), OUTREACH_COLS);
    const id = Number(insert(db, "outreach", row));
    log(db, "outreach", `Drafted ${row.kind} via ${row.channel} to ${row.person_name ?? row.contact} (${row.company ?? ""})`);
    console.log(JSON.stringify({ id }));
    break;
  }
  case "update-outreach":
    update(db, "outreach", Number(args[0]), pick(readJson(args[1]), OUTREACH_COLS), false);
    console.log("ok");
    break;
  case "set-prep": {
    const p = pick(readJson(args[1]), PREP_COLS);
    const jobId = Number(args[0]);
    const keys = Object.keys(p);
    db.prepare(`INSERT INTO prep (job_id, ${keys.join(",")}) VALUES (?, ${keys.map(() => "?").join(",")})
      ON CONFLICT(job_id) DO UPDATE SET ${keys.map((k) => `${k} = excluded.${k}`).join(", ")}, updated_at = datetime('now')`)
      .run(jobId, ...keys.map((k) => p[k]));
    log(db, "job", `Interview prep written for job #${jobId}`);
    console.log("ok");
    break;
  }
  case "log":
    log(db, args[0], args.slice(1).join(" "));
    console.log("ok");
    break;
  case "list": {
    const rows = args[0]
      ? db.prepare("SELECT id, company, title, status, fit_score FROM jobs WHERE status = ? ORDER BY fit_score DESC").all(args[0])
      : db.prepare("SELECT id, company, title, status, fit_score FROM jobs ORDER BY id DESC").all();
    console.table(rows);
    break;
  }
  case "query":
    console.log(JSON.stringify(db.prepare(args.join(" ")).all(), null, 2));
    break;
  case "render":
    console.log(render(args[0], args[1]));
    break;
  default:
    console.error("usage: jh <init|add-job|update-job|add-outreach|update-outreach|set-prep|log|list|query|render>");
    process.exit(1);
}
