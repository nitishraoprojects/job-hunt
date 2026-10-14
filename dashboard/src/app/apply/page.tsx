import { ApplyTabs } from "@/components/apply/apply-tabs"
import { PageBody, PageHeader } from "@/components/page-header"
import { RunTaskButton } from "@/components/run-task-button"
import { all, type JobRow } from "@/lib/db"
import { readSettings } from "@/lib/settings"

export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  const sp = await searchParams
  const settings = readSettings()
  const rows = all<JobRow>(`SELECT id, title, company, logo, city, remote_type, fit_score, status, ats, apply_error, updated_at, resume_pdf
    FROM jobs WHERE status IN ('queued','applying','ready') ORDER BY fit_score DESC`)
  const queue = rows.filter((r) => r.status !== "ready")
  const review = rows.filter((r) => r.status === "ready")
  const questions = settings.pending_questions ?? []
  const tab = typeof sp.tab === "string" ? sp.tab : "live"

  return (
    <>
      <PageHeader
        title="Apply"
        description={settings.autopilot.auto_submit
          ? "Fills and submits each form, and pauses for anything it can't answer."
          : "Review mode: fills each form, then waits for you to click submit."}>
        <RunTaskButton task="apply-queue" label="Start auto-apply" variant="default" icon={false} />
      </PageHeader>
      <PageBody className="max-w-5xl">
        <ApplyTabs initialTab={tab} queue={queue} review={review} questions={questions} />
      </PageBody>
    </>
  )
}
