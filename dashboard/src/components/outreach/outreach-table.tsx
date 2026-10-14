"use client"

import { useState, useTransition } from "react"
import { CopyIcon, ExternalLinkIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"
import { sendEmail, setOutreachStatus } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Outreach } from "@/lib/db"
import { OUTREACH_STATUSES } from "@/lib/statuses"
import { StatusSelect } from "../jobs/bits"

export function OutreachTable({ rows, smtp }: { rows: Outreach[]; smtp: boolean }) {
  const [open, setOpen] = useState<Outreach | null>(null)
  const [pending, start] = useTransition()
  const copy = async (o: Outreach) => {
    await navigator.clipboard.writeText(o.subject ? `${o.subject}\n\n${o.body}` : o.body)
    toast.success("Copied")
  }
  const send = (o: Outreach) => start(async () => {
    const r = await sendEmail(o.id)
    if (r.ok) toast.success(`Sent to ${o.contact}`)
    else toast.error(r.output || "Send failed")
  })
  // LinkedIn: copy the note and open the profile in one click, then mark it sent.
  const linkedin = async (o: Outreach) => {
    await copy(o)
    window.open(o.contact ?? "", "_blank")
    await setOutreachStatus(o.id, "sent")
  }

  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Person</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden md:table-cell">Follow up</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-4 text-right">Send</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No outreach yet.</TableCell></TableRow>}
          {rows.map((o) => (
            <TableRow key={o.id} className="cursor-pointer" onClick={() => setOpen(o)}>
              <TableCell className="pl-4">
                <div className="font-medium">{o.person_name ?? o.contact}</div>
                <div className="text-xs text-muted-foreground">{[o.person_role, o.company].filter(Boolean).join(" · ")}</div>
              </TableCell>
              <TableCell className="space-x-1">
                <Badge variant="outline" className="capitalize">{o.channel}</Badge>
                <Badge variant="secondary">{o.kind.replace(/_/g, " ")}</Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{o.follow_up_on ?? "—"}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <StatusSelect value={o.status} options={OUTREACH_STATUSES} onChange={(v) => setOutreachStatus(o.id, v)} />
              </TableCell>
              <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => copy(o)} aria-label="Copy"><CopyIcon /></Button>
                  {o.channel === "linkedin" && o.contact && (
                    <Button size="sm" variant="outline" onClick={() => linkedin(o)}><ExternalLinkIcon data-icon="inline-start" /> Copy & open</Button>
                  )}
                  {o.channel === "email" && o.status === "drafted" && (
                    <Button size="sm" disabled={!smtp || pending} onClick={() => send(o)} title={smtp ? "" : "Set up email in Settings"}>
                      <SendIcon data-icon="inline-start" /> Send
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.subject ?? `Note to ${open.person_name ?? open.contact}`}</DialogTitle>
                <DialogDescription>{[open.person_name, open.person_role, open.company, open.contact].filter(Boolean).join(" · ")}</DialogDescription>
              </DialogHeader>
              <p className="text-sm whitespace-pre-wrap">{open.body}</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => copy(open)}><CopyIcon data-icon="inline-start" /> Copy</Button>
                {open.channel === "email" && <Button disabled={!smtp || pending} onClick={() => send(open)}><SendIcon data-icon="inline-start" /> Send email</Button>}
                {open.channel === "linkedin" && <Button onClick={() => linkedin(open)}><ExternalLinkIcon data-icon="inline-start" /> Copy & open LinkedIn</Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
