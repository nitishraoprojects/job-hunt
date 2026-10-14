"use client"

import { useTransition } from "react"
import { marked } from "marked"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { statusLabel } from "@/lib/statuses"
import { cn } from "@/lib/utils"

export function StatusSelect({ value, options, onChange, className }: {
  value: string; options: readonly string[]; onChange: (v: string) => Promise<void>; className?: string
}) {
  const [pending, start] = useTransition()
  return (
    <Select value={value} onValueChange={(v) => v && start(async () => { await onChange(v); toast.success(`Moved to ${statusLabel(v)}`) })}>
      <SelectTrigger size="sm" className={cn("w-32", className)} disabled={pending}>
        <SelectValue>{(v: string) => statusLabel(v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{statusLabel(o)}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function FitBadge({ score }: { score: number | null }) {
  if (score == null) return <Badge variant="outline">–</Badge>
  const variant = score >= 75 ? "default" : score >= 55 ? "secondary" : "outline"
  return <Badge variant={variant} className="tabular-nums">{score}</Badge>
}

export function CompanyLogo({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-8 rounded-md", className)}>
      {src && <AvatarImage src={src} alt="" className="rounded-md object-contain" />}
      <AvatarFallback className="rounded-md text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

export function WorkTypeBadge({ type }: { type: string | null }) {
  if (!type || type === "onsite") return null
  return <Badge variant="outline" className="capitalize">{type}</Badge>
}

export function Markdown({ text }: { text: string | null | undefined }) {
  if (!text) return <p className="text-sm text-muted-foreground">Nothing yet.</p>
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 prose-li:my-0.5"
      dangerouslySetInnerHTML={{ __html: marked.parse(text, { async: false }) }} />
  )
}

export function timeAgo(date: string | null) {
  if (!date) return "—"
  const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date.includes("T") ? date : `${date.replace(" ", "T")}Z`)
  const days = Math.floor((Date.now() - d.getTime()) / 864e5)
  if (Number.isNaN(days)) return "—"
  if (days <= 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export const fileUrl = (rel: string) => `/api/file?path=${encodeURIComponent(rel)}`
export const AUTO_ATS = ["greenhouse", "lever", "ashby"]
