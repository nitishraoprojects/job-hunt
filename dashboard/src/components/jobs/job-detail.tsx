"use client"

import { useEffect, useState, useTransition } from "react"
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, FileTextIcon, MoreHorizontalIcon, StarIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { autoApply, setJobStatus, toggleStar } from "@/app/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Job, JobEvent, Prep } from "@/lib/db"
import { statusLabel } from "@/lib/statuses"
import { AUTO_ATS, CompanyLogo, FitBadge, Markdown, WorkTypeBadge, fileUrl, timeAgo } from "./bits"

type Detail = { job: Job | null; prep: Prep | null; events: JobEvent[] }
export const APPLIED = ["applied", "interviewing", "offer", "rejected"]

// Marks a job applied and offers Undo, used by the list rows and the detail pane.
export async function markAppliedWithUndo(job: { id: number; title: string; company: string; status: string }, after?: () => void) {
  const previous = job.status
  await setJobStatus([job.id], "applied")
  after?.()
  toast.success("Marked as applied", {
    description: `${job.title} · ${job.company}`,
    duration: 8000,
    action: { label: "Undo", onClick: async () => { await setJobStatus([job.id], previous); after?.() } },
  })
}

// The job description pane shown beside the list (LinkedIn-style).
export function JobDetail({ jobId, onBack }: { jobId: number; onBack?: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [pending, start] = useTransition()
  const reload = (id: number, signal?: AbortSignal) =>
    fetch(`/api/job/${id}`, { signal, cache: "no-store" }).then((r) => r.json()).then(setDetail).catch(() => {})
  useEffect(() => {
    const ctl = new AbortController()
    reload(jobId, ctl.signal)
    return () => ctl.abort()
  }, [jobId])
  const job = detail?.job?.id === jobId ? detail.job : null

  if (!job) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex gap-3"><Skeleton className="size-12 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/3" /></div></div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const act = (msg: string, fn: () => Promise<unknown>) => start(async () => { await fn(); toast.success(msg); await reload(job.id) })
  const isApplied = APPLIED.includes(job.status)
  const canAuto = AUTO_ATS.includes(job.ats ?? "") && !isApplied && !["queued", "applying"].includes(job.status)

  return (
    <article className="flex min-h-full flex-col">
      <header className="space-y-4 border-b px-6 pt-5 pb-4">
        {onBack && (
          <Button variant="ghost" size="sm" className="-ml-2 lg:hidden" onClick={onBack}><ArrowLeftIcon data-icon="inline-start" /> All jobs</Button>
        )}
        <div className="flex items-start gap-4">
          <CompanyLogo name={job.company} src={job.logo} className="size-12" />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xl leading-snug font-semibold">{job.title}</h2>
            <p className="text-sm text-muted-foreground">
              {job.company} · {job.city ?? job.location ?? "—"} · Posted {timeAgo(job.posted_at ?? job.created_at)} · via {job.source}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <FitBadge score={job.fit_score} />
              <WorkTypeBadge type={job.remote_type} />
              {job.salary && <Badge variant="outline">{job.salary}</Badge>}
              {job.status !== "found" && <Badge variant="secondary">{statusLabel(job.status)}</Badge>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAuto ? (
            <Button disabled={pending} onClick={() => act("Added to the apply run", () => autoApply([job.id]))}><ZapIcon data-icon="inline-start" /> Auto-apply</Button>
          ) : ["queued", "applying"].includes(job.status) ? (
            <Button variant="secondary" disabled><ZapIcon data-icon="inline-start" /> In the apply queue</Button>
          ) : !isApplied && (
            <Button nativeButton={false} render={<a href={job.apply_url ?? job.url ?? "#"} target="_blank" rel="noreferrer" />}><ExternalLinkIcon data-icon="inline-start" /> Apply on site</Button>
          )}
          {isApplied ? (
            <span className="inline-flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-emerald-600"><CheckIcon className="size-4" /> {statusLabel(job.status)}</span>
          ) : (
            <Button variant="outline" disabled={pending} onClick={() => start(() => markAppliedWithUndo(job, () => reload(job.id)))}>
              <CheckIcon data-icon="inline-start" /> Mark applied
            </Button>
          )}
          <Button variant="outline" disabled={pending} onClick={() => act(job.starred ? "Removed from shortlist" : "Shortlisted", () => toggleStar(job.id, !job.starred))}>
            <StarIcon data-icon="inline-start" className={job.starred ? "fill-amber-400 text-amber-400" : ""} /> {job.starred ? "Shortlisted" : "Shortlist"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}><MoreHorizontalIcon /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(job.apply_url ?? job.url ?? "", "_blank")}>Open original posting</DropdownMenuItem>
              {job.resume_pdf && <DropdownMenuItem onClick={() => window.open(fileUrl(job.resume_pdf!), "_blank")}>Tailored resume</DropdownMenuItem>}
              {job.cover_letter && <DropdownMenuItem onClick={() => window.open(fileUrl(job.cover_letter!), "_blank")}>Cover letter</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {["interviewing", "offer", "rejected"].filter((s) => s !== job.status).map((s) => (
                <DropdownMenuItem key={s} onClick={() => act(`Marked ${statusLabel(s).toLowerCase()}`, () => setJobStatus([job.id], s))}>Mark {statusLabel(s).toLowerCase()}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => act("Hidden from your lists", () => setJobStatus([job.id], "skipped"))}>Not interested</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {job.apply_error && <Alert><AlertDescription>{job.apply_error}</AlertDescription></Alert>}
      </header>

      <Tabs defaultValue="jd" key={job.id} className="flex-1 px-6 pt-3 pb-8">
        <TabsList variant="line">
          <TabsTrigger value="jd">Description</TabsTrigger>
          <TabsTrigger value="match">Why it matches</TabsTrigger>
          <TabsTrigger value="prep">Interview prep</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="jd" className="pt-4">
          {job.jd
            ? <p className="max-w-3xl text-[15px] leading-7 whitespace-pre-wrap">{job.jd}</p>
            : <p className="text-sm text-muted-foreground">The full description hasn&apos;t been fetched for this listing yet. <a className="underline" href={job.url ?? "#"} target="_blank" rel="noreferrer">Read it on the original posting</a>.</p>}
        </TabsContent>
        <TabsContent value="match" className="max-w-3xl space-y-5 pt-4">
          <section className="space-y-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Fit score {job.fit_score}</h3>
            <Markdown text={job.fit_notes} />
          </section>
          <section className="space-y-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How you&apos;ll apply</h3>
            <p className="text-sm">
              {AUTO_ATS.includes(job.ats ?? "") ? "Auto-apply fills and submits this form for you."
                : job.ats === "linkedin_easy" ? "LinkedIn Easy Apply — open the posting and apply there."
                : "On the company's site. Auto-apply will try, and pause for anything it can't fill."}
            </p>
            {job.apply_notes && <Markdown text={job.apply_notes} />}
          </section>
          {(job.resume_pdf || job.cover_letter) && (
            <section className="flex flex-wrap gap-2">
              {job.resume_pdf && <Button size="sm" variant="outline" nativeButton={false} render={<a href={fileUrl(job.resume_pdf)} target="_blank" />}><FileTextIcon data-icon="inline-start" /> Tailored resume</Button>}
              {job.cover_letter && <Button size="sm" variant="outline" nativeButton={false} render={<a href={fileUrl(job.cover_letter)} target="_blank" />}><FileTextIcon data-icon="inline-start" /> Cover letter</Button>}
            </section>
          )}
        </TabsContent>
        <TabsContent value="prep" className="max-w-3xl space-y-4 pt-4">
          {detail?.prep ? <PrepBody prep={detail.prep} /> : <p className="text-sm text-muted-foreground">Interview prep is written by the daily run once you apply or shortlist this job.</p>}
        </TabsContent>
        <TabsContent value="timeline" className="pt-4">
          <ol className="space-y-3 border-l pl-4">
            {[...(detail?.events ?? []).map((e) => ({ k: e.id, t: statusLabel(e.status ?? ""), s: `${e.ts}${e.note ? ` · ${e.note}` : ""}` })),
              { k: 0, t: `Found on ${job.source}`, s: job.created_at }].map((e) => (
              <li key={e.k} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                <div className="font-medium">{e.t}</div>
                <div className="text-xs text-muted-foreground">{e.s}</div>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </article>
  )
}

export function PrepBody({ prep }: { prep: Prep }) {
  return (
    <>
      {prep.summary && <Markdown text={prep.summary} />}
      <section><h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Topics to study</h4><Markdown text={prep.topics} /></section>
      <section><h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Likely questions</h4><Markdown text={prep.questions} /></section>
      <section><h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Stories to tell</h4><Markdown text={prep.stories} /></section>
    </>
  )
}
