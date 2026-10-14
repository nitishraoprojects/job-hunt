import "server-only"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { ROOT } from "./db"

export type Settings = {
  search: { keywords: string[]; locations: string[]; include_remote: boolean; linkedin_pages: number; linkedin_days: number; instahyre_skills: string[] }
  scoring: { years_experience: number; preferred_cities: string[]; ok_cities: string[]; [k: string]: unknown }
  answers: Record<string, string>
  custom_answers?: Record<string, string>
  autopilot: { enabled: boolean; fetch_every_hours: number; auto_queue_min_score: number; auto_submit: boolean; daily_apply_limit: number; auto_send_emails: boolean }
  pending_questions?: string[]
}

const FILE = path.join(ROOT, "profile", "settings.json")

// First run: start from the committed example so the dashboard works before any setup.
export const readSettings = (): Settings => {
  if (!existsSync(FILE)) copyFileSync(path.join(ROOT, "profile", "settings.example.json"), FILE)
  return JSON.parse(readFileSync(FILE, "utf8"))
}
export const writeSettings = (s: Settings) => writeFileSync(FILE, JSON.stringify(s, null, 2))
export const smtpConfigured = () => existsSync(path.join(ROOT, ".env")) && /SMTP_PASS=\S+/.test(readFileSync(path.join(ROOT, ".env"), "utf8"))
