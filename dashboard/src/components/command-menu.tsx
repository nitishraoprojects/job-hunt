"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BriefcaseIcon, ClipboardListIcon, FileTextIcon, GraduationCapIcon, HomeIcon, KanbanIcon, RefreshCwIcon,
  SearchIcon, SendIcon, SettingsIcon, ZapIcon,
} from "lucide-react"
import { quickSearch, runTask } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { toast } from "sonner"
import { FitBadge } from "./jobs/bits"

type Hit = Awaited<ReturnType<typeof quickSearch>>[number]

const PAGES = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Jobs", href: "/jobs", icon: BriefcaseIcon },
  { label: "Best matches", href: "/jobs?view=best", icon: BriefcaseIcon },
  { label: "Tracker", href: "/tracker", icon: KanbanIcon },
  { label: "Apply", href: "/apply", icon: ZapIcon },
  { label: "Applications", href: "/applications", icon: ClipboardListIcon },
  { label: "Outreach", href: "/outreach", icon: SendIcon },
  { label: "Interview prep", href: "/prep", icon: GraduationCapIcon },
  { label: "Resumes", href: "/resumes", icon: FileTextIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
]

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      setLoading(true)
      const r = await quickSearch(q)
      if (alive) { setHits(r); setLoading(false) }
    }, 200)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  const go = (href: string) => { setOpen(false); setQ(""); router.push(href) }
  const task = async (name: string, label: string) => {
    setOpen(false)
    const r = await runTask(name)
    toast(r.started ? `${label} started` : `${label} is already running`)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 font-normal text-muted-foreground group-data-[collapsible=icon]:hidden">
        <SearchIcon />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search jobs or jump to a page" className="sm:max-w-xl">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search jobs, companies or pages…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>{loading ? "Searching…" : "No results."}</CommandEmpty>
            {hits.length > 0 && (
              <CommandGroup heading="Jobs">
                {hits.map((h) => (
                  <CommandItem key={h.id} value={`job-${h.id}`} onSelect={() => go(`/jobs?job=${h.id}`)}>
                    <BriefcaseIcon />
                    <span className="truncate">{h.title}</span>
                    <span className="truncate text-muted-foreground">· {h.company}</span>
                    <span className="ml-auto"><FitBadge score={h.fit_score} /></span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Go to">
              {PAGES.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase())).map((p) => (
                <CommandItem key={p.href} value={p.href} onSelect={() => go(p.href)}>
                  <p.icon /> {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {!q && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  <CommandItem value="apply" onSelect={() => task("apply-queue", "Auto-apply")}><ZapIcon /> Start auto-apply</CommandItem>
                  <CommandItem value="fetch" onSelect={() => task("fetch", "Refresh")}><RefreshCwIcon /> Refresh job listings</CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
