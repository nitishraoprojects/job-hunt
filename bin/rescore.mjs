#!/usr/bin/env node
// Re-run location normalization and heuristic scoring over existing jobs (after changing
// bin/lib/normalize.mjs, bin/lib/score.mjs or the scoring settings). Jobs Claude has already
// tailored keep their hand-written score and notes.
import { openDb, readJsonFile } from "./lib/db.mjs";
import { normalizeLocation } from "./lib/normalize.mjs";
import { scoreJob } from "./lib/score.mjs";

const db = openDb();
const cfg = readJsonFile("profile/settings.json");
const jobs = db.prepare("SELECT * FROM jobs").all();
const upd = db.prepare("UPDATE jobs SET city = ?, country = ?, remote_type = ?, fit_score = ?, fit_notes = ? WHERE id = ?");
const updLoc = db.prepare("UPDATE jobs SET city = ?, country = ?, remote_type = ? WHERE id = ?");
db.exec("BEGIN");
for (const j of jobs) {
  const hints = { remote: j.remote_type === "remote" && !/remote/i.test(j.location ?? "") ? true : undefined, country: j.source === "instahyre" ? "India" : undefined };
  const loc = normalizeLocation(j.location ?? "", hints);
  if (j.resume_pdf) { updLoc.run(loc.city, loc.country, loc.remote_type, j.id); continue; }
  const { score, reasons } = scoreJob({ ...j, ...loc }, cfg);
  upd.run(loc.city, loc.country, loc.remote_type, score, reasons.map((r) => `- ${r}`).join("\n"), j.id);
}
db.exec("COMMIT");
console.log(`rescored ${jobs.length} jobs`);
