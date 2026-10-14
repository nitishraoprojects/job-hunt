"use client"

import { setJobStatus } from "@/app/actions"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { JobRow } from "@/lib/db"
import { CompanyLogo, StatusSelect, timeAgo } from "../jobs/bits"
import { useOpenJob } from "@/lib/use-open-job"

const TRACK = ["applied", "interviewing", "offer", "rejected"] as const

export function ApplicationsTable({ rows }: { rows: (JobRow & { has_prep: number; days: number })[] }) {
  const setOpenId = useOpenJob()
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Role</TableHead>
            <TableHead className="hidden md:table-cell">Applied</TableHead>
            <TableHead className="hidden md:table-cell">Via</TableHead>
            <TableHead className="hidden lg:table-cell">Next step</TableHead>
            <TableHead className="pr-4">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No applications yet.</TableCell></TableRow>}
          {rows.map((j) => {
            const days = j.days
            const next = j.status === "interviewing" ? (j.has_prep ? "Study the prep notes" : "Prep being written")
              : j.status === "applied" ? (days >= 7 ? "Follow up / ask for referral" : `Wait — ${7 - days}d until follow-up`) : "—"
            return (
              <TableRow key={j.id} className="cursor-pointer" onClick={() => setOpenId(j.id)}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <CompanyLogo name={j.company} src={j.logo} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{j.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{j.company} · {j.city ?? j.remote_type}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{timeAgo(j.applied_at)}</TableCell>
                <TableCell className="hidden capitalize text-muted-foreground md:table-cell">{j.channel ?? j.ats}</TableCell>
                <TableCell className="hidden text-sm lg:table-cell">{next}</TableCell>
                <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                  <StatusSelect value={j.status} options={TRACK} onChange={(v) => setJobStatus([j.id], v)} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
