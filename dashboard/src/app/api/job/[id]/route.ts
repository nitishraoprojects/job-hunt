import { getEvents, getJob, getPrep } from "@/lib/db"

// Job detail for the description pane. A plain GET (not a server action) so it isn't
// cancelled when the router refreshes the page underneath it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const job = getJob(id)
  if (!job) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json({ job, prep: getPrep(id), events: getEvents(id) }, { headers: { "cache-control": "no-store" } })
}
