import "server-only"
import { DatabaseSync } from "node:sqlite"
import { readFileSync } from "node:fs"
import path from "node:path"

// The dashboard lives in <root>/dashboard; data, resumes and profile live in <root>.
export const ROOT = path.resolve(process.cwd(), "..")

let db: DatabaseSync | null = null

export function getDb() {
  if (!db) {
    db = new DatabaseSync(path.join(ROOT, "data", "jobhunt.db"))
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
    db.exec(readFileSync(path.join(ROOT, "data", "schema.sql"), "utf8"))
    const extra = JSON.parse(readFileSync(path.join(ROOT, "data", "columns.json"), "utf8")) as Record<string, Record<string, string>>
    for (const [table, cols] of Object.entries(extra)) {
      const have = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name))
      for (const [col, type] of Object.entries(cols)) if (!have.has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
    }
  }
  return db
}

// node:sqlite rows have a null prototype, which React won't pass to client components.
type Param = string | number | null
export const all = <T,>(sql: string, ...params: Param[]) =>
  getDb().prepare(sql).all(...params).map((r) => ({ ...r })) as unknown as T[]
export const one = <T,>(sql: string, ...params: Param[]) => {
  const r = getDb().prepare(sql).get(...params)
  return (r ? { ...r } : null) as T | null
}

export type Job = {
  id: number
  external_id: string | null
  company: string
  title: string
  location: string | null
  city: string | null
  country: string | null
  remote_type: string | null
  url: string | null
  apply_url: string | null
  ats: string | null
  source: string | null
  jd: string | null
  salary: string | null
  keywords: string | null
  logo: string | null
  posted_at: string | null
  fit_score: number | null
  fit_notes: string | null
  status: string
  starred: number
  channel: string | null
  resume_md: string | null
  resume_pdf: string | null
  cover_letter: string | null
  apply_notes: string | null
  apply_error: string | null
  applied_at: string | null
  created_at: string
  updated_at: string
}
export type JobRow = Omit<Job, "jd">

export type Outreach = {
  id: number
  job_id: number | null
  channel: string
  kind: string
  person_name: string | null
  person_role: string | null
  company: string | null
  contact: string | null
  subject: string | null
  body: string
  status: string
  sent_at: string | null
  follow_up_on: string | null
  created_at: string
}

export type Prep = { id: number; job_id: number; summary: string | null; topics: string | null; questions: string | null; stories: string | null; updated_at: string }
export type Activity = { id: number; ts: string; kind: string; message: string }
export type JobEvent = { id: number; job_id: number; ts: string; status: string | null; note: string | null }

// ---- Job search -------------------------------------------------------------
export type JobFilters = {
  q?: string
  city?: string[]
  country?: string[]
  remote?: string[]
  source?: string[]
  status?: string[]
  minScore?: number
  days?: number
  autoApply?: boolean
  starred?: boolean
  region?: "india" | "all"
  sort?: "score" | "newest" | "company"
  page?: number
}

export const PAGE_SIZE = 50
const JOB_LIST_COLS = `id, external_id, company, title, location, city, country, remote_type, url, apply_url, ats, source,
  salary, keywords, logo, posted_at, fit_score, fit_notes, status, starred, channel, resume_md, resume_pdf, cover_letter,
  apply_notes, apply_error, applied_at, created_at, updated_at`
export const AUTO_ATS = ["greenhouse", "lever", "ashby"]

function where(f: JobFilters, skip?: keyof JobFilters) {
  const w: string[] = []
  const p: Param[] = []
  const inList = (col: string, vals?: string[]) => {
    if (!vals?.length) return
    w.push(`${col} IN (${vals.map(() => "?").join(",")})`)
    p.push(...vals)
  }
  if (f.q && skip !== "q") {
    w.push("(title LIKE ? OR company LIKE ? OR keywords LIKE ?)")
    p.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`)
  }
  if (skip !== "city") inList("city", f.city)
  if (skip !== "country") inList("country", f.country)
  if (skip !== "remote") inList("remote_type", f.remote)
  if (skip !== "source") inList("source", f.source)
  if (f.status?.length) inList("status", f.status)
  else w.push("status NOT IN ('skipped', 'rejected')")
  if (f.minScore) { w.push("fit_score >= ?"); p.push(f.minScore) }
  if (f.days) { w.push("COALESCE(posted_at, created_at) >= date('now', ?)"); p.push(`-${f.days} days`) }
  if (f.autoApply) w.push(`ats IN (${AUTO_ATS.map((a) => `'${a}'`).join(",")})`)
  if (f.starred) w.push("starred = 1")
  if (f.region !== "all") w.push("(country = 'India' OR (remote_type = 'remote' AND (country IS NULL OR country = 'Worldwide')))")
  return { sql: w.length ? `WHERE ${w.join(" AND ")}` : "", params: p }
}

export function searchJobs(f: JobFilters) {
  const { sql, params } = where(f)
  const order = f.sort === "newest" ? "COALESCE(posted_at, created_at) DESC" : f.sort === "company" ? "company, title" : "fit_score DESC, COALESCE(posted_at, created_at) DESC"
  const page = Math.max(1, f.page ?? 1)
  const rows = all<JobRow>(`SELECT ${JOB_LIST_COLS} FROM jobs ${sql} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, ...params)
  const total = one<{ n: number }>(`SELECT count(*) n FROM jobs ${sql}`, ...params)!.n
  return { rows, total, page }
}

// Facet counts, each computed with every filter applied except its own.
export function facets(f: JobFilters) {
  const facet = (col: string, key: keyof JobFilters, limit = 40) => {
    const { sql, params } = where(f, key)
    return all<{ value: string; n: number }>(
      `SELECT ${col} value, count(*) n FROM jobs ${sql}${sql ? " AND" : " WHERE"} ${col} IS NOT NULL GROUP BY ${col} ORDER BY n DESC LIMIT ${limit}`, ...params)
  }
  return { city: facet("city", "city"), country: facet("country", "country"), remote: facet("remote_type", "remote"), source: facet("source", "source") }
}

export function countJobs(f: JobFilters) {
  const { sql, params } = where(f)
  return one<{ n: number }>(`SELECT count(*) n FROM jobs ${sql}`, ...params)!.n
}

export const getJob = (id: number) => one<Job>("SELECT * FROM jobs WHERE id = ?", id)
export const getPrep = (jobId: number) => one<Prep>("SELECT * FROM prep WHERE job_id = ?", jobId)
export const getEvents = (jobId: number) => all<JobEvent>("SELECT * FROM job_events WHERE job_id = ? ORDER BY id DESC", jobId)

export function stats() {
  const c = (sql: string) => one<{ n: number }>(sql)!.n
  return {
    total: c("SELECT count(*) n FROM jobs"),
    relevant: c("SELECT count(*) n FROM jobs WHERE fit_score >= 75 AND status IN ('found','saved') AND (country = 'India' OR (remote_type = 'remote' AND country = 'Worldwide'))"),
    newToday: c("SELECT count(*) n FROM jobs WHERE created_at >= date('now')"),
    queued: c("SELECT count(*) n FROM jobs WHERE status IN ('queued','applying')"),
    ready: c("SELECT count(*) n FROM jobs WHERE status = 'ready'"),
    applied: c("SELECT count(*) n FROM jobs WHERE status IN ('applied','interviewing','offer','rejected') AND applied_at IS NOT NULL"),
    appliedToday: c("SELECT count(*) n FROM jobs WHERE date(applied_at) = date('now')"),
    interviewing: c("SELECT count(*) n FROM jobs WHERE status = 'interviewing'"),
    offers: c("SELECT count(*) n FROM jobs WHERE status = 'offer'"),
    outreachSent: c("SELECT count(*) n FROM outreach WHERE status NOT IN ('drafted','in_gmail')"),
    outreachDrafted: c("SELECT count(*) n FROM outreach WHERE status IN ('drafted','in_gmail')"),
    replies: c("SELECT count(*) n FROM outreach WHERE status IN ('replied','referred')"),
  }
}

export const navCounts = () => one<Record<string, number>>(`SELECT
  (SELECT count(*) FROM jobs WHERE status NOT IN ('skipped','rejected')) jobs,
  (SELECT count(*) FROM jobs WHERE fit_score >= 70 AND status IN ('found','saved')) best,
  (SELECT count(*) FROM jobs WHERE starred = 1) starred,
  (SELECT count(*) FROM jobs WHERE status IN ('queued','applying','ready')) queue,
  (SELECT count(*) FROM jobs WHERE status IN ('applied','interviewing','offer')) applications,
  (SELECT count(*) FROM outreach WHERE status IN ('drafted','in_gmail')) outreach,
  (SELECT count(*) FROM prep) prep`)!
