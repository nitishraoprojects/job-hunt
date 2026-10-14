"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, EyeOffIcon, MousePointerClickIcon, SearchXIcon, StarIcon, XIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { autoApply, setJobStatus, toggleStar } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { JobRow } from "@/lib/db"
import { statusLabel } from "@/lib/statuses"
import { useOpenJob } from "@/lib/use-open-job"
import { cn } from "@/lib/utils"
import { CompanyLogo, FitBadge, timeAgo } from "./bits"
import { APPLIED, JobDetail, markAppliedWithUndo } from "./job-detail"

// LinkedIn-style workspace: scrollable list on the left, the selected job's description on the right.
export function JobsWorkspace({ rows, total, page, pageSize }: { rows: JobRow[]; total: number; page: number; pageSize: number }) {
  const [selected, setSelected] = useState<number[]>([])
  const [pending, start] = useTransition()
  const openJob = useOpenJob()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const explicit = Number(params.get("job")) || null
  // Large screens always show a job (the first one by default); small screens show one pane at a time.
  const activeId = explicit ?? rows[0]?.id ?? null

  const go = (p: number) => {
    const next = new URLSearchParams(params)
    next.set("page", String(p))
    next.delete("job")
    router.push(`${pathname}?${next}`)
  }
  const run = (label: string, fn: () => Promise<unknown>) => start(async () => { await fn(); toast.success(label); setSelected([]) })
  const toggle = (id: number, on: boolean) => setSelected(on ? [...selected, id] : selected.filter((x) => x !== id))
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id))

  if (!rows.length) {
    return (
      <Empty className="m-4 border md:m-8">
        <EmptyHeader>
          <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
          <EmptyTitle>No jobs match</EmptyTitle>
          <EmptyDescription>Try removing a filter or switching to another view.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 border-t">
      {/* List */}
      <section className={cn("flex min-h-0 w-full flex-col border-r lg:w-[440px] lg:shrink-0 xl:w-[480px]", explicit && "hidden lg:flex")}>
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <Checkbox checked={allOnPage} aria-label="Select all on page"
            onCheckedChange={(v) => setSelected(v ? [...new Set([...selected, ...rows.map((r) => r.id)])] : selected.filter((id) => !rows.some((r) => r.id === id)))} />
          <span className="flex-1">{((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}</span>
          <Button size="icon-xs" variant="ghost" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page"><ChevronLeftIcon /></Button>
          <Button size="icon-xs" variant="ghost" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page"><ChevronRightIcon /></Button>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {rows.map((j) => {
            const isSel = selected.includes(j.id)
            const isActive = j.id === activeId
            return (
              <li key={j.id} onClick={() => openJob(j.id)} aria-current={isActive || undefined}
                className={cn("group relative flex cursor-pointer gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50",
                  isActive && "bg-primary/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary",
                  isSel && "bg-muted/60")}>
                <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={isSel} onCheckedChange={(v) => toggle(j.id, !!v)} aria-label="Select job" />
                </span>
                <CompanyLogo name={j.company} src={j.logo} className="size-10" />
                <div className="min-w-0 flex-1">
                  <div className={cn("line-clamp-2 leading-snug font-medium", isActive && "text-primary")}>{j.title}</div>
                  <div className="mt-0.5 truncate text-sm">{j.company}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {j.city ?? (j.remote_type === "remote" ? "Remote" : j.country ?? "—")}
                    {j.remote_type !== "onsite" && j.city && <span className="capitalize"> ({j.remote_type})</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{timeAgo(j.posted_at ?? j.created_at)}</span>
                    {j.starred ? <StarIcon className="size-3.5 fill-amber-400 text-amber-400" /> : null}
                    {j.status !== "found" && !APPLIED.includes(j.status) && <Badge variant="secondary">{statusLabel(j.status)}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <FitBadge score={j.fit_score} />
                  {APPLIED.includes(j.status) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckIcon className="size-3.5" /> {statusLabel(j.status)}
                    </span>
                  ) : (
                    <Button size="xs" variant="outline" disabled={pending} onClick={() => start(() => markAppliedWithUndo(j))}>
                      <CheckIcon data-icon="inline-start" /> Mark applied
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Description */}
      <section className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", !explicit && "hidden lg:block")}>
        {activeId ? <JobDetail jobId={activeId} onBack={() => openJob(null)} /> : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MousePointerClickIcon /></EmptyMedia>
              <EmptyTitle>Select a job</EmptyTitle>
              <EmptyDescription>Its description and actions show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {/* Floating bulk bar: appears only while something is selected. */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-4 shadow-lg backdrop-blur">
          <span className="mr-2 text-sm font-medium">{selected.length} selected</span>
          <Button size="sm" className="rounded-full" disabled={pending} onClick={() => run(`${selected.length} jobs added to the apply run`, () => autoApply(selected))}>
            <ZapIcon data-icon="inline-start" /> Auto-apply
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run("Marked as applied", () => setJobStatus(selected, "applied"))}>
            <CheckIcon data-icon="inline-start" /> Mark applied
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run("Shortlisted", () => Promise.all(selected.map((id) => toggleStar(id, true))))}>
            <StarIcon data-icon="inline-start" /> Shortlist
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run("Hidden", () => setJobStatus(selected, "skipped"))}>
            <EyeOffIcon data-icon="inline-start" /> Hide
          </Button>
          <Button size="icon-sm" variant="ghost" className="rounded-full" onClick={() => setSelected([])} aria-label="Clear selection"><XIcon /></Button>
        </div>
      )}
    </div>
  )
}
