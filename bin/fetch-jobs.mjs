#!/usr/bin/env node
// Pull listings from every source, dedupe, normalize location, score, and upsert.
//   node bin/fetch-jobs.mjs              all sources
//   node bin/fetch-jobs.mjs linkedin ats only the named sources
import { openDb, log, readJsonFile } from "./lib/db.mjs";
import { normalizeLocation, atsFromUrl } from "./lib/normalize.mjs";
import { scoreJob } from "./lib/score.mjs";
import { pool, sleep } from "./lib/http.mjs";
import { ATS } from "./sources/ats.mjs";
import * as boards from "./sources/boards.mjs";

const db = openDb();
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS jobs_ext ON jobs(external_id)");
const cfg = readJsonFile("profile/settings.json");
const only = process.argv.slice(2);
const want = (name) => !only.length || only.includes(name);

const companyKey = (s = "") => s.toLowerCase()
  .replace(/\b(private|pvt|limited|ltd|inc|llc|technologies|technology|tech|software|solutions|india|labs|hq|services)\b/g, "")
  .replace(/[^a-z0-9]/g, "");
const titleKey = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const prettySlug = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const findByExt = db.prepare("SELECT id FROM jobs WHERE external_id = ? OR url = ?");
const insert = db.prepare(`INSERT INTO jobs (external_id, company, title, location, city, country, remote_type, url, apply_url, ats,
  source, jd, salary, keywords, logo, posted_at, fit_score, fit_notes, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`);
const touch = db.prepare("UPDATE jobs SET last_seen_at = datetime('now') WHERE id = ?");
const linkAts = db.prepare("UPDATE jobs SET apply_url = ?, ats = ?, jd = COALESCE(jd, ?) WHERE id = ?");
const dupeIndex = new Map(db.prepare("SELECT id, company, title, city FROM jobs").all()
  .map((r) => [`${companyKey(r.company)}|${titleKey(r.title)}|${r.city ?? ""}`, r.id]));

function upsert(raw, source) {
  if (!raw.title || !raw.url) return false;
  const company = raw.company ?? "Unknown";
  const existing = findByExt.get(raw.external_id, raw.url);
  if (existing) { touch.run(existing.id); return false; }
  const loc = normalizeLocation(raw.location, raw.hints ?? {});
  const key = `${companyKey(company)}|${titleKey(raw.title)}|${loc.city ?? ""}`;
  const apply_url = raw.apply_url ?? raw.url;
  const ats = atsFromUrl(apply_url);
  if (dupeIndex.has(key)) {
    // Same job from another source: keep one row, but prefer an ATS link we can auto-apply through.
    const id = dupeIndex.get(key);
    if (["greenhouse", "lever", "ashby"].includes(ats)) linkAts.run(apply_url, ats, raw.jd ?? null, id);
    touch.run(id);
    return false;
  }
  const job = { ...raw, company, ...loc };
  const { score, reasons } = scoreJob(job, cfg);
  const r = insert.run(raw.external_id, company, raw.title.trim(), raw.location ?? null, loc.city, loc.country, loc.remote_type,
    raw.url, apply_url, ats, source, raw.jd || null, raw.salary ?? null, raw.keywords ?? null, raw.logo ?? null,
    raw.posted_at ?? null, score, reasons.map((x) => `- ${x}`).join("\n"));
  dupeIndex.set(key, Number(r.lastInsertRowid));
  return true;
}

async function run(source, fn) {
  const t = Date.now();
  let seen = 0, added = 0, error = null;
  try {
    const rows = await fn();
    seen = rows.length;
    db.exec("BEGIN");
    for (const { raw, src } of rows) if (upsert(raw, src)) added++;
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* not in a transaction */ }
    error = e.message;
  }
  db.prepare("INSERT INTO source_runs (source, seen, added, error) VALUES (?, ?, ?, ?)").run(source, seen, added, error);
  console.log(`${source.padEnd(12)} seen ${String(seen).padStart(5)}  new ${String(added).padStart(5)}  ${((Date.now() - t) / 1000).toFixed(0)}s${error ? `  ERROR ${error}` : ""}`);
  return added;
}

const tag = (src) => (rows) => rows.map((raw) => ({ raw, src }));
let total = 0;

if (want("ats")) {
  total += await run("ats", async () => {
    const list = readJsonFile("profile/boards.json");
    const jobs = Object.entries(list).flatMap(([ats, slugs]) => slugs.map((slug) => ({ ats, slug })));
    const results = await pool(jobs, 12, async ({ ats, slug }) =>
      (await ATS[ats](slug)).map((j) => ({ raw: { ...j, company: prettySlug(slug) }, src: ats })));
    return results.filter(Array.isArray).flat();
  });
}
for (const name of ["remotive", "remoteok", "himalayas", "jobicy", "instahyre"]) {
  if (want(name)) total += await run(name, async () => tag(name)(await boards[name](cfg)));
}
if (want("linkedin")) {
  total += await run("linkedin", async () => tag("linkedin")(await boards.linkedin(cfg, (e) => console.error(`  linkedin: ${e.message}`))));
}

// Fetch full JDs for promising LinkedIn listings, then rescore with the real description.
if (want("linkedin") || want("enrich")) {
  const todo = db.prepare(`SELECT * FROM jobs WHERE source = 'linkedin' AND jd IS NULL AND fit_score >= 50
    AND status NOT IN ('skipped','rejected') ORDER BY fit_score DESC LIMIT 200`).all();
  let n = 0;
  await pool(todo, 3, async (job) => {
    try {
      const d = await boards.linkedinDetail(job.external_id.slice(3));
      const { score, reasons } = scoreJob({ ...job, jd: d.jd }, cfg);
      db.prepare(`UPDATE jobs SET jd = ?, fit_score = ?, fit_notes = ?, apply_notes = COALESCE(apply_notes, ?) WHERE id = ?`)
        .run(d.jd || null, score, reasons.map((x) => `- ${x}`).join("\n"),
          d.easy_apply ? "LinkedIn Easy Apply only." : null, job.id);
      if (d.easy_apply) db.prepare("UPDATE jobs SET ats = 'linkedin_easy' WHERE id = ? AND ats = 'linkedin'").run(job.id);
      n++;
    } catch (e) { if (e.status === 429) await sleep(30000); }
    await sleep(800);
  });
  console.log(`enriched     ${n} LinkedIn descriptions`);
}

log(db, "run", `Fetched all sources: ${total} new listings`);
console.log(`\n${total} new listings. Total in DB: ${db.prepare("SELECT count(*) n FROM jobs").get().n}`);
