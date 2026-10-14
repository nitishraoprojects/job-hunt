"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { autoApply, setJobStatus } from "@/app/actions"
import { Button } from "@/components/ui/button"
import type { JobRow } from "@/lib/db"
import { useOpenJob } from "@/lib/use-open-job"
import { CompanyLogo, FitBadge } from "../jobs/bits"

export function QueueTable({ rows }: { rows: JobRow[] }) {
  const openJob = useOpenJob()
  const [pending, start] = useTransition()
  const run = (msg: string, fn: () => Promise<unknown>) => start(async () => { await fn(); toast.success(msg) })

  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {rows.map((j) => (
        <li key={j.id} onClick={() => openJob(j.id)} className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50">
          <CompanyLogo name={j.company} src={j.logo} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{j.title}</div>
            <div className="truncate text-sm text-muted-foreground">
              {j.status === "applying" ? <span className="text-emerald-600">Applying now…</span>
                : j.apply_error ? j.apply_error : `${j.company} · ${j.ats}`}
            </div>
          </div>
          <FitBadge score={j.fit_score} />
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {j.status === "ready" && (
              <>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run("Back in the queue", () => autoApply([j.id]))}>Retry</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("Marked applied", () => setJobStatus([j.id], "applied"))}>I applied</Button>
              </>
            )}
            {j.status === "queued" && (
              <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" disabled={pending}
                onClick={() => run("Removed from queue", () => setJobStatus([j.id], "saved"))}>Remove</Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
