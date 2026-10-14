import { PageBody, PageHeader } from "@/components/page-header"
import { Board } from "@/components/tracker/board"
import { all, type JobRow } from "@/lib/db"
import { BOARD } from "@/lib/statuses"

export default function TrackerPage() {
  const statuses = BOARD.map((c) => c.status)
  const jobs = all<JobRow>(`SELECT id, title, company, logo, city, remote_type, fit_score, status, starred, applied_at, updated_at, ats, apply_error
    FROM jobs WHERE status IN (${statuses.map(() => "?").join(",")}) OR (starred = 1 AND status = 'found')
    ORDER BY updated_at DESC LIMIT 600`, ...statuses)
  // Starred jobs that haven't moved yet show in the first column.
  const cards = jobs.map((j) => (j.status === "found" ? { ...j, status: "saved" } : j))
  return (
    <>
      <PageHeader title="Tracker" description="Drag cards between columns to update their status" />
      <PageBody><Board jobs={cards} /></PageBody>
    </>
  )
}
