import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { JobsToolbar } from "@/components/jobs/filters"
import { JobsWorkspace } from "@/components/jobs/jobs-table"
import { RunTaskButton } from "@/components/run-task-button"
import { PAGE_SIZE, countJobs, facets, searchJobs, type JobFilters as F } from "@/lib/db"

const list = (v?: string | string[]) => (typeof v === "string" && v ? v.split(",") : undefined)

// Saved views shown as tabs. Each is a preset merged under whatever the user filters on top.
const VIEWS: Record<string, { label: string; preset: Partial<F> }> = {
  all: { label: "All", preset: {} },
  best: { label: "Best matches", preset: { minScore: 75, status: ["found", "saved"] } },
  ncr: { label: "Delhi NCR", preset: { city: ["Noida", "Delhi", "Gurugram"] } },
  remote: { label: "Remote", preset: { remote: ["remote"] } },
  shortlist: { label: "Shortlist", preset: { starred: true } },
}

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const sp = await searchParams
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)
  const view = VIEWS[s("view") ?? "all"] ? (s("view") ?? "all") : "all"
  const base: F = { region: s("region") === "all" ? "all" : "india" }
  const user: F = {
    q: s("q"), city: list(sp.city), country: list(sp.country), remote: list(sp.remote), source: list(sp.source),
    status: list(sp.status), minScore: Number(s("minScore")) || undefined, days: Number(s("days")) || undefined,
    autoApply: s("auto") === "1",
  }
  const defined = Object.fromEntries(Object.entries(user).filter(([, v]) => v !== undefined && v !== false)) as F
  const filters: F = { ...base, ...VIEWS[view].preset, ...defined, sort: (s("sort") as F["sort"]) ?? "score", page: Number(s("page")) || 1 }
  const { rows, total, page } = searchJobs(filters)
  const viewCounts = Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, countJobs({ ...base, ...v.preset })]))

  // Full-height layout: header and filters on top, then list + description panes that scroll independently.
  return (
    <div className="flex h-svh flex-col overflow-hidden md:h-[calc(100svh-1rem)]">
      <PageHeader title="Jobs" description="Every listing from LinkedIn, Instahyre, job boards and company career pages — ranked for you.">
        <RunTaskButton task="fetch" label="Refresh" variant="ghost" />
      </PageHeader>
      <Suspense>
        <div className="px-4 pb-3 md:px-8">
          <JobsToolbar facets={facets(filters)} views={Object.entries(VIEWS).map(([k, v]) => ({ key: k, label: v.label, count: viewCounts[k] }))} view={view} total={total} />
        </div>
        <JobsWorkspace rows={rows} total={total} page={page} pageSize={PAGE_SIZE} />
      </Suspense>
    </div>
  )
}
