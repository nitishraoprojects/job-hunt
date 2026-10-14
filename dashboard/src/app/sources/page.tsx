import { readFileSync } from "node:fs"
import path from "node:path"
import { TaskLog } from "@/components/apply/task-log"
import { PageBody, PageHeader } from "@/components/page-header"
import { RunTaskButton } from "@/components/run-task-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROOT, all } from "@/lib/db"

type Run = { source: string; ts: string; seen: number; added: number; error: string | null }

export default function SourcesPage() {
  const runs = all<Run>(`SELECT r.source, r.ts, r.seen, r.added, r.error FROM source_runs r
    JOIN (SELECT source, max(id) id FROM source_runs GROUP BY source) last ON last.id = r.id ORDER BY r.source`)
  const counts = new Map(all<{ source: string; n: number; good: number }>(
    "SELECT source, count(*) n, sum(fit_score >= 60) good FROM jobs GROUP BY source").map((r) => [r.source, r]))
  const boards = JSON.parse(readFileSync(path.join(ROOT, "profile", "boards.json"), "utf8")) as Record<string, string[]>
  const ats = Object.entries(boards).map(([k, v]) => ({ name: k, companies: v.length }))
  const sources = [...new Set([...runs.map((r) => r.source), ...counts.keys()])]

  return (
    <>
      <PageHeader title="Sources" description="Where listings come from and how each source is doing">
        <RunTaskButton task="discover" label="Discover more companies" />
        <RunTaskButton task="fetch-linkedin" label="Fetch LinkedIn" />
        <RunTaskButton task="fetch" label="Fetch everything" variant="default" />
      </PageHeader>
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="py-0 lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Source</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Fit 60+</TableHead>
                  <TableHead className="hidden md:table-cell">Last run</TableHead>
                  <TableHead className="pr-4">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => {
                  const r = runs.find((x) => x.source === s)
                  const c = counts.get(s)
                  return (
                    <TableRow key={s}>
                      <TableCell className="pl-4 font-medium capitalize">{s}</TableCell>
                      <TableCell className="text-right tabular-nums">{(c?.n ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{(c?.good ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{r ? `${r.ts} · +${r.added}` : "—"}</TableCell>
                      <TableCell className="max-w-56 truncate pr-4">
                        {r?.error ? <Badge variant="destructive" title={r.error}>Error</Badge> : r ? <Badge variant="secondary">OK</Badge> : <Badge variant="outline">via ATS</Badge>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Company career boards</CardTitle>
              <CardDescription>Companies polled directly. These support auto-apply.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ats.map((a) => (
                <div key={a.name} className="flex justify-between text-sm"><span className="capitalize">{a.name}</span><span className="tabular-nums text-muted-foreground">{a.companies}</span></div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">Add company names to profile/companies.txt and run “Discover more companies”.</p>
            </CardContent>
          </Card>
        </div>
        <TaskLog tasks={["fetch", "fetch-linkedin", "fetch-fast", "discover"]} />
      </PageBody>
    </>
  )
}
