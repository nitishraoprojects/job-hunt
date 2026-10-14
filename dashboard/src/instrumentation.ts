// Autopilot: while the dashboard server runs, tick every 15 minutes. bin/autopilot.mjs
// exits immediately unless autopilot is enabled in Settings.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startTask } = await import("./lib/tasks")
  const { readSettings } = await import("./lib/settings")
  const tick = () => {
    try {
      if (readSettings().autopilot.enabled) startTask("autopilot")
    } catch (e) {
      console.error("autopilot tick failed", e)
    }
  }
  setTimeout(tick, 60_000)
  setInterval(tick, 15 * 60_000)
}
