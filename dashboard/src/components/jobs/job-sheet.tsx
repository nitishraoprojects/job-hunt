"use client"

import { useEffect, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { CheckIcon, ExternalLinkIcon, FileTextIcon, MoreHorizontalIcon, StarIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { autoApply, loadJobDetail, setJobStatus, toggleStar } from "@/app/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Job, JobEvent, Prep } from "@/lib/db"
import { statusLabel } from "@/lib/statuses"
import { useOpenJob } from "@/lib/use-open-job"
import { AUTO_ATS, CompanyLogo, FitBadge, Markdown, WorkTypeBadge, fileUrl, timeAgo } from "./bits"

type Detail = { job: Job | null; prep: Prep | null; events: JobEvent[] }
const DONE = ["applied", "interviewing", "offer", "rejected"]

// One job panel for the whole app, opened by ?job=<id>.
export function GlobalJobSheet() {
  const params = useSearchParams()
  const openJob = useOpenJob()
  const jobId = Number(params.get("job")) || null
  const [detail, setDetail] = useState<Detail | null>(null)
  const [pending, start] = useTransition()
  const reload = (id: number) => loadJobDetail(id).then(setDetail)
  useEffect(() => { if (jobId) reload(jobId) }, [jobId])
  const job = detail?.job?.id === jobId ? detail.job : null

  const act = (msg: string, fn: () => Promise<unknown>) => start(async () => { await fn(); toast.success(msg); if (job) await reload(job.id) })
  const canAuto = job && AUTO_ATS.includes(job.ats ?? "") && !DONE.includes(job.status) && !["queued", "applying"].includes(job.status)

  return (
    <Sheet open={jobId != null} onOpenChange={(o) => !o && openJob(null)}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        {!job ? (
          <div className="space-y-3 p-6"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-48 w-full" /></div>
        ) : (
          <>
            <SheetHeader className="gap-3 border-b pb-4">
              <div className="flex items-start gap-3 pr-8">
                <CompanyLogo name={job.company} src={job.logo} className="size-11" />
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="text-lg leading-snug">{job.title}</SheetTitle>
                  <SheetDescription>{job.company} · {job.city ?? job.location ?? "—"}</SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <FitBadge score={job.fit_score} />
                <WorkTypeBadge type={job.remote_type} />
                {job.salary && <Badge variant="outline">{job.salary}</Badge>}
                {job.status !== "found" && <Badge variant="secondary">{statusLabel(job.status)}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">Posted {timeAgo(job.posted_at ?? job.created_at)} · {job.source}</span>
              </div>
            </SheetHeader>

            <Tabs defaultValue="overview" className="min-h-0 flex-1 px-4 pt-3">
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="jd">Description</TabsTrigger>
                <TabsTrigger value="prep">Prep</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <ScrollArea className="min-h-0 flex-1">
                <TabsContent value="overview" className="space-y-5 py-3 pr-3">
                  {job.apply_error && (
                    <Alert><AlertDescription>{job.apply_error}</AlertDescription></Alert>
                  )}
                  <section className="space-y-1.5">
                    <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Why it&apos;s a match</h4>
                    <Markdown text={job.fit_notes} />
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How you&apos;ll apply</h4>
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
                <TabsContent value="jd" className="py-3 pr-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{job.jd ?? "Description not fetched yet — open the posting to read it."}</p>
                </TabsContent>
                <TabsContent value="prep" className="space-y-4 py-3 pr-3">
                  {detail?.prep ? <PrepBody prep={detail.prep} /> : <p className="text-sm text-muted-foreground">Interview prep is written by the daily run once you apply or shortlist this job.</p>}
                </TabsContent>
                <TabsContent value="timeline" className="py-3 pr-3">
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
              </ScrollArea>
            </Tabs>

            {/* One obvious next step, always in the same place. */}
            <SheetFooter className="flex-row items-center gap-2 border-t bg-background">
              {canAuto ? (
                <Button className="flex-1" disabled={pending} onClick={() => act("Added to the apply run", () => autoApply([job.id]))}>
                  <ZapIcon data-icon="inline-start" /> Auto-apply
                </Button>
              ) : DONE.includes(job.status) ? (
                <Button className="flex-1" variant="secondary" disabled><CheckIcon data-icon="inline-start" /> {statusLabel(job.status)}</Button>
              ) : ["queued", "applying"].includes(job.status) ? (
                <Button className="flex-1" variant="secondary" disabled><ZapIcon data-icon="inline-start" /> In the apply queue</Button>
              ) : (
                <Button className="flex-1" nativeButton={false} render={<a href={job.apply_url ?? job.url ?? "#"} target="_blank" rel="noreferrer" />}>
                  <ExternalLinkIcon data-icon="inline-start" /> Apply on site
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Shortlist" onClick={() => act(job.starred ? "Removed from shortlist" : "Shortlisted", () => toggleStar(job.id, !job.starred))} />}>
                  <StarIcon className={job.starred ? "fill-current" : ""} />
                </TooltipTrigger>
                <TooltipContent>{job.starred ? "Remove from shortlist" : "Shortlist"}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More" />}><MoreHorizontalIcon /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  <DropdownMenuItem onClick={() => window.open(job.apply_url ?? job.url ?? "", "_blank")}>Open posting</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {["applied", "interviewing", "offer", "rejected"].filter((s) => s !== job.status).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => act(`Marked ${statusLabel(s).toLowerCase()}`, () => setJobStatus([job.id], s))}>Mark {statusLabel(s).toLowerCase()}</DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => act("Hidden", async () => { await setJobStatus([job.id], "skipped"); openJob(null) })}>Not interested</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
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
