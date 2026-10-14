"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Jobs open in one shared side panel driven by ?job=<id>, so any page (or ⌘K) can open one.
export function useOpenJob() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (id: number | null) => {
    const next = new URLSearchParams(params)
    if (id == null) next.delete("job")
    else next.set("job", String(id))
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
}
