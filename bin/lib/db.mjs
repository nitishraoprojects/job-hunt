import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Personal files are git-ignored; on a fresh clone they start as copies of the committed examples.
const PERSONAL = [
  ["profile/settings.example.json", "profile/settings.json"],
  ["profile/profile.example.md", "profile/profile.md"],
  ["resumes/master/resume.example.md", "resumes/master/resume.md"],
];
for (const [example, real] of PERSONAL) {
  if (!existsSync(join(ROOT, real)) && existsSync(join(ROOT, example))) copyFileSync(join(ROOT, example), join(ROOT, real));
}

export function openDb() {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  const db = new DatabaseSync(join(ROOT, "data", "jobhunt.db"));
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(readFileSync(join(ROOT, "data", "schema.sql"), "utf8"));
  const extra = JSON.parse(readFileSync(join(ROOT, "data", "columns.json"), "utf8"));
  for (const [table, cols] of Object.entries(extra)) {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [col, type] of Object.entries(cols)) {
      if (!have.has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  }
  db.exec(`CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS jobs_score ON jobs(fit_score);
    CREATE INDEX IF NOT EXISTS jobs_city ON jobs(city);`);
  return db;
}

export function log(db, kind, message) {
  db.prepare("INSERT INTO activity (kind, message) VALUES (?, ?)").run(kind, message);
}

export function setStatus(db, id, status, note = null) {
  const extra = status === "applied" ? ", applied_at = COALESCE(applied_at, datetime('now'))" : "";
  db.prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now')${extra} WHERE id = ?`).run(status, id);
  db.prepare("INSERT INTO job_events (job_id, status, note) VALUES (?, ?, ?)").run(id, status, note);
}

export const readJsonFile = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
