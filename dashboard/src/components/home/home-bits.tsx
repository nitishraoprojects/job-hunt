"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { autoApply, runTask } from "@/app/actions"
import { Button } from "@/components/ui/button"
import type { JobRow } from "@/lib/db"
import { useOpenJob } from "@/lib/use-open-job"
import { AUTO_ATS, CompanyLogo, FitBadge, WorkTypeBadge } from "../jobs/bits"

export function NextActionButton({ label, href, task }: { label: string; href?: string; task?: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  if (href) return <Button size="lg" nativeButton={false} render={<Link href={href} />}>{label} <ArrowRightIcon data-icon="inline-end" /></Button>
  return (
    <Button size="lg" disabled={pending} onClick={() => start(async () => {
      const r = await runTask(task!)
      toast(r.started ? "Auto-apply started — follow along on the Apply page" : "A run is already in progress")
      router.push("/apply")
    })}>
      <ZapIcon data-icon="inline-start" /> {label}
    </Button>
  )
}

export function HomeJobRow({ job }: { job: JobRow }) {
  const openJob = useOpenJob()
  const [pending, start] = useTransition()
  const auto = AUTO_ATS.includes(job.ats ?? "")
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openJob(job.id)}>
        <CompanyLogo name={job.company} src={job.logo} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium group-hover:underline">{job.title}</div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {job.company} · {job.city ?? "Remote"} <WorkTypeBadge type={job.remote_type} />
          </div>
        </div>
      </button>
      {auto && (
        <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" disabled={pending}
          onClick={() => start(async () => { await autoApply([job.id]); toast.success("Added to the apply run") })}>
          <ZapIcon data-icon="inline-start" /> Apply
        </Button>
      )}
      <FitBadge score={job.fit_score} />
    </div>
  )
}
