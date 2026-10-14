"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type Facet = { value: string; n: number }
export type Facets = { city: Facet[]; country: Facet[]; remote: Facet[]; source: Facet[] }

function useParamsState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const set = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete("page")
    start(() => router.replace(`${pathname}?${next}`, { scroll: false }))
  }
  return { params, set, pending }
}

const DAYS: Record<string, string> = { "1": "Past 24 hours", "3": "Past 3 days", "7": "Past week", "30": "Past month" }
const SORTS: Record<string, string> = { score: "Best fit", newest: "Newest", company: "Company" }
const FILTER_KEYS = ["city", "remote", "source", "days", "minScore", "auto", "region", "country"]

function CheckList({ param, facet, limit = 8 }: { param: string; facet: Facet[]; limit?: number }) {
  const { params, set } = useParamsState()
  const [more, setMore] = useState(false)
  const selected = params.get(param)?.split(",").filter(Boolean) ?? []
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]
    set({ [param]: next.join(",") || null })
  }
  const shown = more ? facet : facet.slice(0, limit)
  return (
    <div className="space-y-1">
      {shown.map((f) => (
        <Label key={f.value} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 font-normal hover:bg-muted">
          <Checkbox checked={selected.includes(f.value)} onCheckedChange={() => toggle(f.value)} />
          <span className="flex-1 capitalize">{f.value}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{f.n.toLocaleString()}</span>
        </Label>
      ))}
      {facet.length > limit && (
        <Button variant="link" size="sm" className="h-auto px-2" onClick={() => setMore(!more)}>{more ? "Show less" : `Show all ${facet.length}`}</Button>
      )}
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function FiltersSheet({ facets, total, active }: { facets: Facets; total: number; active: number }) {
  const { params, set } = useParamsState()
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        <SlidersHorizontalIcon data-icon="inline-start" /> Filters
        {active > 0 && <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5">{active}</Badge>}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Results update as you choose.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <FilterSection title="Location"><CheckList param="city" facet={facets.city} /></FilterSection>
          <FilterSection title="Work type"><CheckList param="remote" facet={facets.remote} /></FilterSection>
          <FilterSection title="Minimum fit">
            <ToggleGroup variant="outline" value={[params.get("minScore") ?? ""]} onValueChange={(v) => set({ minScore: v[0] || null })}>
              {[["", "Any"], ["60", "60+"], ["70", "70+"], ["80", "80+"]].map(([v, l]) => <ToggleGroupItem key={l} value={v}>{l}</ToggleGroupItem>)}
            </ToggleGroup>
          </FilterSection>
          <FilterSection title="Posted">
            <ToggleGroup variant="outline" className="flex-wrap" value={[params.get("days") ?? ""]} onValueChange={(v) => set({ days: v[0] || null })}>
              {[["", "Any time"], ["1", "24h"], ["7", "Week"], ["30", "Month"]].map(([v, l]) => <ToggleGroupItem key={l} value={v}>{l}</ToggleGroupItem>)}
            </ToggleGroup>
          </FilterSection>
          <FilterSection title="Source"><CheckList param="source" facet={facets.source} limit={5} /></FilterSection>
          <Separator />
          <Label className="flex items-center justify-between font-normal">
            <span>
              <span className="block text-sm font-medium">Auto-apply ready only</span>
              <span className="text-xs text-muted-foreground">Forms the engine can fill and submit</span>
            </span>
            <Switch checked={params.get("auto") === "1"} onCheckedChange={(v) => set({ auto: v ? "1" : null })} />
          </Label>
          <Label className="flex items-center justify-between font-normal">
            <span>
              <span className="block text-sm font-medium">Include jobs outside India</span>
              <span className="text-xs text-muted-foreground">Off: India and remote roles only</span>
            </span>
            <Switch checked={params.get("region") === "all"} onCheckedChange={(v) => set({ region: v ? "all" : null })} />
          </Label>
        </div>
        <SheetFooter className="flex-row border-t">
          <Button variant="ghost" onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>Clear all</Button>
          <SheetTrigger render={<Button className="flex-1" />}>Show {total.toLocaleString()} jobs</SheetTrigger>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function JobsToolbar({ facets, views, view, total }: {
  facets: Facets; views: { key: string; label: string; count: number }[]; view: string; total: number
}) {
  const { params, set, pending } = useParamsState()
  const [q, setQ] = useState(params.get("q") ?? "")
  useEffect(() => {
    const t = setTimeout(() => { if ((params.get("q") ?? "") !== q) set({ q: q || null }) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // Removable chips for everything currently applied.
  const chips: { label: string; clear: () => void }[] = []
  for (const k of ["city", "remote", "source"]) {
    for (const v of params.get(k)?.split(",").filter(Boolean) ?? []) {
      chips.push({ label: v, clear: () => set({ [k]: params.get(k)!.split(",").filter((x) => x !== v).join(",") || null }) })
    }
  }
  if (params.get("minScore")) chips.push({ label: `Fit ${params.get("minScore")}+`, clear: () => set({ minScore: null }) })
  if (params.get("days")) chips.push({ label: DAYS[params.get("days")!] ?? `${params.get("days")} days`, clear: () => set({ days: null }) })
  if (params.get("auto")) chips.push({ label: "Auto-apply ready", clear: () => set({ auto: null }) })
  if (params.get("region") === "all") chips.push({ label: "Worldwide", clear: () => set({ region: null }) })
  const active = chips.length

  return (
    <div className={cn("space-y-3 transition-opacity", pending && "opacity-60")}>
      <Tabs value={view} onValueChange={(v) => set({ view: v === "all" ? null : String(v) })}>
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
          {views.map((v) => (
            <TabsTrigger key={v.key} value={v.key} className="flex-none gap-1.5">
              {v.label}
              <span className="text-xs tabular-nums text-muted-foreground">{v.count.toLocaleString()}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role, company or skill" className="pl-9" />
        </div>
        <FiltersSheet facets={facets} total={total} active={active} />
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{total.toLocaleString()} jobs · sort by</span>
          <Select value={params.get("sort") ?? "score"} onValueChange={(v) => set({ sort: v === "score" ? null : v })}>
            <SelectTrigger size="sm" className="w-28 border-none shadow-none"><SelectValue>{(v: string) => SORTS[v]}</SelectValue></SelectTrigger>
            <SelectContent align="end">
              {Object.entries(SORTS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Badge key={c.label} variant="secondary" className="h-7 gap-1 rounded-full pr-1 pl-3 capitalize">
              {c.label}
              <button onClick={c.clear} className="rounded-full p-0.5 hover:bg-background" aria-label={`Remove ${c.label}`}><XIcon className="size-3" /></button>
            </Badge>
          ))}
          <Button variant="link" size="sm" onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>Clear all</Button>
        </div>
      )}
    </div>
  )
}
