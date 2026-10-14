import { ApplicationsTable } from "@/components/applications/applications-table"
import { PageBody, PageHeader } from "@/components/page-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { all, type JobRow } from "@/lib/db"

export default function ApplicationsPage() {
  const rows = all<JobRow & { has_prep: number; days: number }>(`SELECT CAST(julianday('now') - julianday(j.applied_at) AS INTEGER) days, j.id, j.title, j.company, j.logo, j.city, j.remote_type, j.status, j.applied_at,
    j.channel, j.ats, j.fit_score, EXISTS(SELECT 1 FROM prep p WHERE p.job_id = j.id) has_prep
    FROM jobs j WHERE j.status IN ('applied','interviewing','offer','rejected') AND j.applied_at IS NOT NULL ORDER BY j.applied_at DESC`)
  const by = (s: string) => rows.filter((r) => r.status === s).length
  const responded = by("interviewing") + by("offer") + by("rejected")
  const funnel = [
    { label: "Applied", value: rows.length },
    { label: "Response rate", value: rows.length ? `${Math.round((responded / rows.length) * 100)}%` : "—" },
    { label: "Interviewing", value: by("interviewing") },
    { label: "Offers", value: by("offer") },
    { label: "Rejected", value: by("rejected") },
  ]
  return (
    <>
      <PageHeader title="Applications" description="Everything you've applied to and where it stands" />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {funnel.map((f) => (
            <Card key={f.label} size="sm">
              <CardHeader><CardDescription>{f.label}</CardDescription><CardTitle className="text-2xl tabular-nums">{f.value}</CardTitle></CardHeader>
            </Card>
          ))}
        </div>
        <ApplicationsTable rows={rows} />
      </PageBody>
    </>
  )
}
