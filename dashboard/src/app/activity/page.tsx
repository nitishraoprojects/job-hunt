import { PageBody, PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { all, type Activity } from "@/lib/db"

export default function ActivityPage() {
  const rows = all<Activity>("SELECT * FROM activity ORDER BY id DESC LIMIT 300")
  return (
    <>
      <PageHeader title="Activity" description="Everything the system and the daily run did" />
      <PageBody>
        <Card>
          <CardContent className="space-y-2">
            {rows.map((a) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <span className="w-36 shrink-0 tabular-nums text-muted-foreground">{a.ts}</span>
                <Badge variant={a.kind === "needs_input" ? "default" : "outline"} className="w-24 shrink-0 justify-center">{a.kind.replace("_", " ")}</Badge>
                <span className="min-w-0">{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
