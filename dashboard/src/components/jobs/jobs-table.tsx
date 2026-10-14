"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon, EyeOffIcon, SearchXIcon, StarIcon, XIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { autoApply, setJobStatus, toggleStar } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { JobRow } from "@/lib/db"
import { statusLabel } from "@/lib/statuses"
import { useOpenJob } from "@/lib/use-open-job"
import { cn } from "@/lib/utils"
import { AUTO_ATS, CompanyLogo, FitBadge, timeAgo } from "./bits"

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label={label} onClick={(e) => { e.stopPropagation(); onClick() }} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function JobsTable({ rows, total, page, pageSize }: { rows: JobRow[]; total: number; page: number; pageSize: number }) {
  const [selected, setSelected] = useState<number[]>([])
  const [pending, start] = useTransition()
  const openJob = useOpenJob()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const pages = Math.max(1, Math.ceil(total / pageSize))

  const go = (p: number) => {
    const next = new URLSearchParams(params)
    next.set("page", String(p))
    router.push(`${pathname}?${next}`)
  }
  const run = (label: string, fn: () => Promise<unknown>) => start(async () => { await fn(); toast.success(label); setSelected([]) })
  const toggle = (id: number, on: boolean) => setSelected(on ? [...selected, id] : selected.filter((x) => x !== id))
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id))

  if (!rows.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
          <EmptyTitle>No jobs match</EmptyTitle>
          <EmptyDescription>Try removing a filter or switching to another view.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <Checkbox checked={allOnPage} aria-label="Select all on page"
            onCheckedChange={(v) => setSelected(v ? [...new Set([...selected, ...rows.map((r) => r.id)])] : selected.filter((id) => !rows.some((r) => r.id === id)))} />
          <span className="flex-1">Role</span>
          <span className="w-12 text-right">Fit</span>
          <span className="w-[88px]" />
        </div>
        <ul className="divide-y">
          {rows.map((j) => {
            const auto = AUTO_ATS.includes(j.ats ?? "")
            const isSel = selected.includes(j.id)
            return (
              <li key={j.id} onClick={() => openJob(j.id)}
                className={cn("group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50", isSel && "bg-muted/60")}>
                <span onClick={(e) => e.stopPropagation()}><Checkbox checked={isSel} onCheckedChange={(v) => toggle(j.id, !!v)} aria-label="Select job" /></span>
                <CompanyLogo name={j.company} src={j.logo} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{j.title}</span>
                    {j.starred ? <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
                    {j.status !== "found" && <Badge variant="secondary" className="shrink-0">{statusLabel(j.status)}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {j.company}
                    <span className="mx-1.5 text-muted-foreground/50">·</span>
                    {j.city ?? (j.remote_type === "remote" ? "Remote" : j.country ?? "—")}
                    {j.remote_type !== "onsite" && j.city && <span className="capitalize"> ({j.remote_type})</span>}
                    <span className="mx-1.5 text-muted-foreground/50">·</span>
                    {timeAgo(j.posted_at ?? j.created_at)}
                  </div>
                </div>
                <div className="w-12 text-right"><FitBadge score={j.fit_score} /></div>
                {/* Quiet until hover so the list stays calm. */}
                <div className="flex w-[88px] justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {auto && !["applied", "interviewing", "offer", "queued", "applying"].includes(j.status) && (
                    <IconAction label="Auto-apply" onClick={() => run("Added to the apply run", () => autoApply([j.id]))}><ZapIcon /></IconAction>
                  )}
                  <IconAction label={j.starred ? "Remove from shortlist" : "Shortlist"} onClick={() => run(j.starred ? "Removed" : "Shortlisted", () => toggleStar(j.id, !j.starred))}>
                    <StarIcon className={j.starred ? "fill-current" : ""} />
                  </IconAction>
                  <IconAction label="Not interested" onClick={() => run("Hidden", () => setJobStatus([j.id], "skipped"))}><EyeOffIcon /></IconAction>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => go(page - 1)}><ChevronLeftIcon data-icon="inline-start" /> Prev</Button>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => go(page + 1)}>Next <ChevronRightIcon data-icon="inline-end" /></Button>
        </div>
      </div>

      {/* Floating bulk bar: appears only while something is selected. */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-4 shadow-lg backdrop-blur">
          <span className="mr-2 text-sm font-medium">{selected.length} selected</span>
          <Button size="sm" className="rounded-full" disabled={pending} onClick={() => run(`${selected.length} jobs added to the apply run`, () => autoApply(selected))}>
            <ZapIcon data-icon="inline-start" /> Auto-apply
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
    </>
  )
}
