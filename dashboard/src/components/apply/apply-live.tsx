"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2Icon, CircleAlertIcon, Loader2Icon, PauseCircleIcon, SkipForwardIcon, SquareIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { getApplyProgress, sendApplyControl, type ApplyProgress } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function useApplyProgress(intervalMs: number) {
  const [p, setP] = useState<ApplyProgress | null>(null)
  const router = useRouter()
  const wasRunning = useRef(false)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      const next = await getApplyProgress()
      if (!alive) return
      setP(next)
      // Refresh server-rendered lists when a run finishes or a job completes.
      if (wasRunning.current && !next?.running) router.refresh()
      wasRunning.current = !!next?.running
    }
    tick()
    const t = setInterval(tick, intervalMs)
    return () => { alive = false; clearInterval(t) }
  }, [intervalMs, router])
  return p
}

const STEP_LABEL: Record<string, string> = {
  opening: "Opening the application form",
  filling: "Filling in your details",
  waiting_for_you: "Waiting for you",
  ready_to_submit: "All filled — submitting shortly",
  submitting: "Submitting",
  confirming: "Checking for confirmation",
}

const REASON: Record<string, string> = {
  missing_fields: "Fill the highlighted fields in the Chrome window. The run continues on its own once nothing required is empty.",
  captcha: "The site is showing a CAPTCHA. Solve it in the Chrome window, then the run continues.",
  review: "Review mode: check the filled form in the Chrome window and click the site's Submit button.",
  confirm: "The site didn't show a confirmation. Check the Chrome window, fix anything it flagged and submit, or mark it applied.",
}

const ITEM_ICON: Record<string, React.ReactNode> = {
  applied: <CheckCircle2Icon className="size-4 text-emerald-600" />,
  failed: <XCircleIcon className="size-4 text-destructive" />,
  skipped: <SkipForwardIcon className="size-4 text-muted-foreground" />,
  needs_input: <CircleAlertIcon className="size-4 text-amber-600" />,
}

export function ApplyLive() {
  const p = useApplyProgress(1500)
  const [pending, start] = useTransition()
  const control = (action: Parameters<typeof sendApplyControl>[0], msg: string) =>
    start(async () => { await sendApplyControl(action); toast(msg) })

  if (!p || (!p.running && !p.items.length)) return null
  const done = p.counts.applied + p.counts.failed + p.counts.skipped + p.counts.needs_input
  const total = done + p.remaining + (p.current ? 1 : 0)
  const c = p.current
  const waiting = c?.step === "waiting_for_you"

  return (
    <Card className={cn(waiting && "border-amber-500")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {p.running ? <Loader2Icon className="size-4 animate-spin" /> : <PauseCircleIcon className="size-4" />}
          {p.running ? "Auto-apply running" : "Last auto-apply run"}
          <Badge variant="outline">{p.mode === "auto" ? "Auto-submit" : "Review mode"}</Badge>
        </CardTitle>
        <CardDescription>
          {done} of {total} done · {p.counts.applied} applied · {p.remaining} remaining in queue
        </CardDescription>
        {p.running && (
          <CardAction>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => control("stop", "Stopping after this job")}>
              <SquareIcon data-icon="inline-start" /> Stop run
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={total ? (done / total) * 100 : 0} />
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {[
            ["Applied", p.counts.applied], ["Waiting for you", waiting ? 1 : 0], ["Needs input", p.counts.needs_input],
            ["Failed", p.counts.failed], ["Remaining", p.remaining],
          ].map(([label, n]) => (
            <div key={label} className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{n}</div>
            </div>
          ))}
        </div>

        {c && (
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Now applying</div>
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-sm text-muted-foreground">{c.company} · {c.ats}</div>
              </div>
              <Badge variant={waiting ? "default" : "secondary"} className={cn(waiting && "bg-amber-500 text-black")}>
                {c.step === "ready_to_submit" && c.submit_in_ms != null
                  ? `Submitting in ${Math.ceil(c.submit_in_ms / 1000)}s`
                  : STEP_LABEL[c.step] ?? c.step}
              </Badge>
            </div>

            {waiting && c.reason && (
              <Alert className="mt-3 border-amber-500/50">
                <CircleAlertIcon />
                <AlertTitle>Needs you in the Chrome window</AlertTitle>
                <AlertDescription>
                  <p>{REASON[c.reason]}</p>
                  {!!c.missing?.length && (
                    <ul className="mt-2 list-disc pl-4">
                      {c.missing.map((m) => <li key={m} className="first-letter:uppercase">{m}</li>)}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {p.running && (
              <div className="mt-3 flex flex-wrap gap-2">
                {c.step === "ready_to_submit" && (
                  <Button size="sm" disabled={pending} onClick={() => control("submit", "Submitting now")}>Submit now</Button>
                )}
                {(waiting || c.step === "ready_to_submit") && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => control("applied", "Marked as applied")}>
                    <CheckCircle2Icon data-icon="inline-start" /> I submitted it
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => control("skip", "Skipping this job")}>
                  <SkipForwardIcon data-icon="inline-start" /> Skip this job
                </Button>
              </div>
            )}
          </div>
        )}

        {p.items.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">This run</div>
            {p.items.slice(0, 12).map((it) => (
              <div key={`${it.id}-${it.at}`} className="flex items-center gap-2 text-sm">
                {ITEM_ICON[it.status]}
                <span className="truncate font-medium">{it.title}</span>
                <span className="shrink-0 text-muted-foreground">· {it.company}</span>
                <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{it.note}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact status for the sidebar footer, visible on every page.
export function ApplyMini() {
  const p = useApplyProgress(3000)
  if (!p?.running) return null
  const done = p.counts.applied + p.counts.failed + p.counts.skipped + p.counts.needs_input
  const total = done + p.remaining + (p.current ? 1 : 0)
  const waiting = p.current?.step === "waiting_for_you"
  return (
    <Link href="/apply" className={cn("block rounded-md border px-3 py-2 text-xs group-data-[collapsible=icon]:hidden", waiting && "border-amber-500 bg-amber-500/10")}>
      <div className="flex items-center gap-1.5 font-medium">
        <Loader2Icon className="size-3 animate-spin" />
        {waiting ? "Waiting for you" : "Applying"} · {done}/{total}
      </div>
      {p.current && <div className="mt-0.5 truncate text-muted-foreground">{p.current.company} — {p.current.title}</div>}
      <Progress value={total ? (done / total) * 100 : 0} className="mt-1.5 h-1" />
    </Link>
  )
}
