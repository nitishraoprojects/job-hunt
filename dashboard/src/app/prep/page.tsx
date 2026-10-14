import { PageBody, PageHeader } from "@/components/page-header"
import { PrepBody } from "@/components/jobs/job-detail"
import { CompanyLogo } from "@/components/jobs/bits"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { all, type Prep } from "@/lib/db"
import { statusLabel } from "@/lib/statuses"

type Row = Prep & { title: string; company: string; logo: string | null; status: string }

export default function PrepPage() {
  const rows = all<Row>(`SELECT p.*, j.title, j.company, j.logo, j.status FROM prep p JOIN jobs j ON j.id = p.job_id
    ORDER BY CASE j.status WHEN 'interviewing' THEN 0 WHEN 'applied' THEN 1 ELSE 2 END, p.updated_at DESC`)
  return (
    <>
      <PageHeader title="Interview prep" description="What each interview will test, topics to study, likely questions and which stories to tell" />
      <PageBody>
        {rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Prep is written by the daily run for jobs you&apos;re applying to.</CardContent></Card>
        ) : (
          <Tabs defaultValue={String(rows[0].job_id)} orientation="vertical" className="gap-4 md:flex-row">
            <TabsList className="h-fit w-full shrink-0 flex-col items-stretch md:w-72">
              {rows.map((r) => (
                <TabsTrigger key={r.job_id} value={String(r.job_id)} className="h-auto justify-start gap-2 py-2 text-left whitespace-normal">
                  <CompanyLogo name={r.company} src={r.logo} className="size-6" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.company}</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {rows.map((r) => (
              <TabsContent key={r.job_id} value={String(r.job_id)} className="min-w-0 flex-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">{r.title} <Badge variant="secondary">{statusLabel(r.status)}</Badge></CardTitle>
                    <CardDescription>{r.company} · updated {r.updated_at}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5"><PrepBody prep={r} /></CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PageBody>
    </>
  )
}
