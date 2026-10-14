"use server"

import { revalidatePath } from "next/cache"
import { getDb, getEvents, getJob, getPrep } from "@/lib/db"
import { readSettings, writeSettings, type Settings } from "@/lib/settings"
import { JOB_STATUSES, OUTREACH_STATUSES } from "@/lib/statuses"
import { startTask, taskStatus } from "@/lib/tasks"

function log(kind: string, message: string) {
  getDb().prepare("INSERT INTO activity (kind, message) VALUES (?, ?)").run(kind, message)
}

export async function setJobStatus(ids: number[], status: string) {
  if (!(JOB_STATUSES as readonly string[]).includes(status)) throw new Error("bad status")
  const db = getDb()
  const appliedAt = status === "applied" ? ", applied_at = COALESCE(applied_at, datetime('now'))" : ""
  const upd = db.prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now')${appliedAt} WHERE id = ?`)
  const ev = db.prepare("INSERT INTO job_events (job_id, status, note) VALUES (?, ?, 'from dashboard')")
  db.exec("BEGIN")
  for (const id of ids) { upd.run(status, id); ev.run(id, status) }
  db.exec("COMMIT")
  log("job", `${ids.length} job${ids.length > 1 ? "s" : ""} → ${status}`)
  revalidatePath("/", "layout")
}

export async function toggleStar(id: number, starred: boolean) {
  getDb().prepare("UPDATE jobs SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id)
  revalidatePath("/", "layout")
}

export async function loadJobDetail(id: number) {
  return { job: getJob(id), prep: getPrep(id), events: getEvents(id) }
}

export async function autoApply(ids: number[]) {
  // Queue them; one apply run works through the queue in score order.
  // One apply run works through the queue in score order and picks up jobs queued while it runs.
  await setJobStatus(ids, "queued")
  return { started: startTask("apply-queue") }
}

export async function runTask(name: string) {
  const started = startTask(name)
  revalidatePath("/", "layout")
  return { started }
}

export async function getTaskStatus() {
  return taskStatus()
}

export async function setOutreachStatus(id: number, status: string) {
  if (!(OUTREACH_STATUSES as readonly string[]).includes(status)) throw new Error("bad status")
  const sentAt = status === "sent"
    ? ", sent_at = COALESCE(sent_at, datetime('now')), follow_up_on = COALESCE(follow_up_on, date('now', '+5 days'))"
    : ""
  getDb().prepare(`UPDATE outreach SET status = ?${sentAt} WHERE id = ?`).run(status, id)
  log("outreach", `Outreach #${id} → ${status}`)
  revalidatePath("/", "layout")
}

export async function sendEmail(id: number) {
  const { spawnSync } = await import("node:child_process")
  const { ROOT } = await import("@/lib/db")
  const r = spawnSync("node", ["--no-warnings", "bin/send-email.mjs", "--id", String(id)], { cwd: ROOT, encoding: "utf8" })
  revalidatePath("/", "layout")
  return { ok: r.status === 0 && r.stdout.includes("✓"), output: (r.stdout + r.stderr).trim() }
}

export async function saveSettings(patch: Partial<Settings>) {
  const s = readSettings()
  const next: Settings = {
    ...s,
    ...patch,
    search: { ...s.search, ...patch.search },
    scoring: { ...s.scoring, ...patch.scoring },
    answers: { ...s.answers, ...patch.answers },
    custom_answers: { ...s.custom_answers, ...patch.custom_answers },
    autopilot: { ...s.autopilot, ...patch.autopilot },
  }
  writeSettings(next)
  log("settings", "Settings updated")
  revalidatePath("/", "layout")
}

export async function answerQuestions(answers: Record<string, string>) {
  const s = readSettings()
  s.custom_answers = { ...s.custom_answers, ...Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim())) }
  s.pending_questions = (s.pending_questions ?? []).filter((q) => !s.custom_answers![q])
  writeSettings(s)
  // Jobs that were blocked on questions go back into the queue.
  getDb().prepare("UPDATE jobs SET status = 'queued', apply_error = NULL WHERE status = 'ready' AND apply_error LIKE 'Needs answers%'").run()
  log("settings", `Answered ${Object.keys(answers).length} application questions`)
  revalidatePath("/", "layout")
}

export async function saveSmtp(user: string, pass: string) {
  const { writeFileSync } = await import("node:fs")
  const path = await import("node:path")
  const { ROOT } = await import("@/lib/db")
  const env = [
    "# Used by bin/send-email.mjs. Gmail: create an app password at myaccount.google.com/apppasswords",
    "SMTP_HOST=smtp.gmail.com", "SMTP_PORT=465", `SMTP_USER=${user.trim()}`, `SMTP_PASS=${pass.replace(/\s+/g, "")}`, `SMTP_FROM=${user.trim()}`, "",
  ].join("\n")
  writeFileSync(path.join(ROOT, ".env"), env, { mode: 0o600 })
  log("settings", "Email sending configured")
  revalidatePath("/", "layout")
}

export type ApplyProgress = {
  pid: number
  running: boolean
  mode: "auto" | "review"
  interactive: boolean
  started_at: string
  updated_at: string | null
  counts: { applied: number; failed: number; skipped: number; needs_input: number }
  remaining: number
  current: null | {
    id: number; title: string; company: string; ats: string; url: string; started_at: string
    step: "opening" | "filling" | "waiting_for_you" | "ready_to_submit" | "submitting" | "confirming"
    reason?: "missing_fields" | "captcha" | "review" | "confirm"; missing?: string[]; submit_in_ms?: number | null; waiting_since?: string
  }
  items: { id: number; title: string; company: string; status: string; note: string; at: string }[]
}

export async function getApplyProgress(): Promise<ApplyProgress | null> {
  const { existsSync, readFileSync } = await import("node:fs")
  const path = await import("node:path")
  const { ROOT } = await import("@/lib/db")
  const file = path.join(ROOT, "data", "logs", "apply-progress.json")
  if (!existsSync(file)) return null
  try {
    const p = JSON.parse(readFileSync(file, "utf8")) as ApplyProgress
    if (p.running) {
      try { process.kill(p.pid, 0) } catch { p.running = false; p.current = null }
    }
    return p
  } catch {
    return null
  }
}

export async function sendApplyControl(action: "skip" | "stop" | "submit" | "applied") {
  const { writeFileSync } = await import("node:fs")
  const path = await import("node:path")
  const { ROOT } = await import("@/lib/db")
  writeFileSync(path.join(ROOT, "data", "logs", "apply-control.json"), JSON.stringify({ action }))
}

export async function quickSearch(q: string) {
  const { all } = await import("@/lib/db")
  if (q.trim().length < 2) return []
  const like = `%${q.trim()}%`
  return all<{ id: number; title: string; company: string; city: string | null; fit_score: number | null; status: string }>(
    `SELECT id, title, company, city, fit_score, status FROM jobs WHERE (title LIKE ? OR company LIKE ?) AND status != 'skipped'
     ORDER BY fit_score DESC LIMIT 8`, like, like)
}

export async function forgetAnswer(question: string) {
  const s = readSettings()
  const { [question]: _gone, ...rest } = s.custom_answers ?? {}
  void _gone
  s.custom_answers = rest
  writeSettings(s)
  log("settings", `Forgot remembered answer: ${question.slice(0, 80)}`)
  revalidatePath("/", "layout")
}
