-- Job hunt database. Shared by the dashboard and bin/ scripts.
-- Columns added after a table was first created live in data/columns.json and are
-- applied on open by both bin/lib/db.mjs and dashboard/src/lib/db.ts.
CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company       TEXT NOT NULL,
  title         TEXT NOT NULL,
  location      TEXT,
  url           TEXT UNIQUE,
  source        TEXT,
  jd            TEXT,
  salary        TEXT,
  fit_score     INTEGER,
  fit_notes     TEXT,
  status        TEXT NOT NULL DEFAULT 'found',
                -- found | saved | queued | tailored | ready | applying | applied | interviewing | offer | rejected | skipped
  channel       TEXT,
  resume_md     TEXT,
  resume_pdf    TEXT,
  cover_letter  TEXT,
  apply_notes   TEXT,
  applied_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id    INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ts        TEXT NOT NULL DEFAULT (datetime('now')),
  status    TEXT,
  note      TEXT
);

CREATE TABLE IF NOT EXISTS outreach (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id         INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  channel        TEXT NOT NULL,
  kind           TEXT NOT NULL,
  person_name    TEXT,
  person_role    TEXT,
  company        TEXT,
  contact        TEXT,
  subject        TEXT,
  body           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'drafted',
  gmail_draft_id TEXT,
  sent_at        TEXT,
  follow_up_on   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prep (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  summary     TEXT,
  topics      TEXT,
  questions   TEXT,
  stories     TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL DEFAULT (datetime('now')),
  kind     TEXT NOT NULL,
  message  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_runs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (datetime('now')),
  source    TEXT NOT NULL,
  seen      INTEGER NOT NULL DEFAULT 0,
  added     INTEGER NOT NULL DEFAULT 0,
  error     TEXT
);
