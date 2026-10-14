"use client"

import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { setJobStatus } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { JobRow } from "@/lib/db"
import { BOARD } from "@/lib/statuses"
import { cn } from "@/lib/utils"
import { CompanyLogo, FitBadge, timeAgo } from "../jobs/bits"
import { useOpenJob } from "@/lib/use-open-job"

export function Board({ jobs }: { jobs: JobRow[] }) {
  const [optimistic, move] = useOptimistic(jobs, (state, { id, status }: { id: number; status: string }) =>
    state.map((j) => (j.id === id ? { ...j, status } : j)))
  const [, start] = useTransition()
  const [over, setOver] = useState<string | null>(null)
  const setOpenId = useOpenJob()

  const drop = (status: string, id: number) => start(async () => {
    move({ id, status })
    await setJobStatus([id], status)
    toast.success(`Moved to ${BOARD.find((c) => c.status === status)?.label}`)
  })

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex min-h-[70vh] gap-3 pb-4">
          {BOARD.map((col) => {
            const items = optimistic.filter((j) => j.status === col.status)
            return (
              <div key={col.status}
                onDragOver={(e) => { e.preventDefault(); setOver(col.status) }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => { setOver(null); drop(col.status, Number(e.dataTransfer.getData("text/plain"))) }}
                className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 p-2 transition-colors", over === col.status && "border-primary bg-muted")}>
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-sm font-medium">{col.label}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((j) => (
                    <Card key={j.id} size="sm" draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(j.id))}
                      onClick={() => setOpenId(j.id)}
                      className="cursor-grab gap-2 px-3 active:cursor-grabbing">
                      <div className="flex items-start gap-2">
                        <CompanyLogo name={j.company} src={j.logo} className="size-7" />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-medium leading-snug">{j.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{j.company}</div>
                        </div>
                        <FitBadge score={j.fit_score} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{j.city ?? (j.remote_type === "remote" ? "Remote" : "")}</span>
                        <span>{timeAgo(j.applied_at ?? j.updated_at)}</span>
                      </div>
                      {j.apply_error && col.status === "ready" && <p className="line-clamp-2 text-xs text-destructive">{j.apply_error}</p>}
                    </Card>
                  ))}
                  {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop jobs here</p>}
                </div>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </>
  )
}
