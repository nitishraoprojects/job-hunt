import "server-only"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { ROOT } from "./db"

// Background jobs the dashboard can start. Each writes to data/logs/<name>.log.
export const TASKS = {
  fetch: { label: "Fetch all job sources", args: ["bin/fetch-jobs.mjs"] },
  "fetch-fast": { label: "Fetch boards (no LinkedIn)", args: ["bin/fetch-jobs.mjs", "ats", "remotive", "remoteok", "himalayas", "jobicy", "instahyre"] },
  "fetch-linkedin": { label: "Fetch LinkedIn", args: ["bin/fetch-jobs.mjs", "linkedin"] },
  discover: { label: "Discover company boards", args: ["bin/discover-boards.mjs"] },
  "apply-queue": { label: "Auto-apply to queue", args: ["bin/apply.mjs", "--queue"] },
  autopilot: { label: "Autopilot tick", args: ["bin/autopilot.mjs"] },
  "send-emails": { label: "Send drafted emails", args: ["bin/send-email.mjs", "--all"] },
} as const
export type TaskName = keyof typeof TASKS

const LOGS = path.join(ROOT, "data", "logs")
const pidFile = (name: string) => path.join(LOGS, `${name}.pid`)

function alive(pid: number) {
  try { process.kill(pid, 0); return true } catch { return false }
}

export function isRunning(name: string) {
  if (!existsSync(pidFile(name))) return false
  return alive(Number(readFileSync(pidFile(name), "utf8")))
}

export function startTask(name: string, extra: string[] = []) {
  mkdirSync(LOGS, { recursive: true })
  if (isRunning(name)) return false
  const base = name in TASKS ? [...TASKS[name as TaskName].args] : []
  if (!base.length) throw new Error(`unknown task ${name}`)
  const out = openSync(path.join(LOGS, `${name}.log`), "w")
  const child = spawn("node", ["--no-warnings", ...base, ...extra], { cwd: ROOT, detached: true, stdio: ["ignore", out, out], env: process.env })
  writeFileSync(pidFile(name), String(child.pid))
  child.unref()
  return true
}

export function taskStatus() {
  return Object.entries(TASKS).map(([name, t]) => {
    const logPath = path.join(LOGS, `${name}.log`)
    const tail = existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n").slice(-6).join("\n") : ""
    return { name, label: t.label, running: isRunning(name), tail }
  })
}
