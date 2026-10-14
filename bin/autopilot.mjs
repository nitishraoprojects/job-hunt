#!/usr/bin/env node
// One autopilot tick: fetch new listings if due, queue + apply to top matches, send approved emails.
// The dashboard runs this every 15 minutes while autopilot is enabled in Settings.
// To run it without the dashboard, add to your crontab:  */30 * * * * cd ~/job-hunt && node --no-warnings bin/autopilot.mjs
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { openDb, log, readJsonFile, ROOT } from "./lib/db.mjs";

const s = readJsonFile("profile/settings.json");
if (!s.autopilot.enabled && !process.argv.includes("--force")) { console.log("Autopilot is off."); process.exit(0); }

const db = openDb();
const node = (script, ...args) => execFileSync("node", ["--no-warnings", join(ROOT, "bin", script), ...args], { stdio: "inherit", cwd: ROOT });
const lastFetch = db.prepare("SELECT max(ts) t FROM source_runs").get().t;
const hours = lastFetch ? (Date.now() - new Date(`${lastFetch}Z`).getTime()) / 36e5 : Infinity;

if (hours >= s.autopilot.fetch_every_hours) node("fetch-jobs.mjs");
node("apply.mjs", "--auto-queue", "--queue");
if (s.autopilot.auto_send_emails) {
  try { node("send-email.mjs", "--all"); } catch { /* no SMTP configured */ }
}
log(db, "run", "Autopilot tick finished");
