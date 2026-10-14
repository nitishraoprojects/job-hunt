"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Jobs open in the description pane on the Jobs page, selected by ?job=<id>.
// On the Jobs page selection only updates the URL (no reload of the list);
// anywhere else it navigates to the Jobs page with that job open.
export function useOpenJob() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (id: number | null) => {
    if (pathname !== "/jobs") {
      if (id != null) router.push(`/jobs?job=${id}`)
      return
    }
    const next = new URLSearchParams(params)
    if (id == null) next.delete("job")
    else next.set("job", String(id))
    const qs = next.toString()
    window.history.replaceState(null, "", qs ? `/jobs?${qs}` : "/jobs")
  }
}
