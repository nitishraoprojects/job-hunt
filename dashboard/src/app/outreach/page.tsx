import Link from "next/link"
import { OutreachTable } from "@/components/outreach/outreach-table"
import { PageBody, PageHeader } from "@/components/page-header"
import { RunTaskButton } from "@/components/run-task-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { all, type Outreach } from "@/lib/db"
import { smtpConfigured } from "@/lib/settings"

export default function OutreachPage() {
  const rows = all<Outreach>("SELECT * FROM outreach ORDER BY CASE status WHEN 'drafted' THEN 0 WHEN 'in_gmail' THEN 0 ELSE 1 END, id DESC")
  const smtp = smtpConfigured()
  return (
    <>
      <PageHeader title="Outreach" description="Referral asks, cold emails and follow-ups drafted by the daily run">
        {smtp && <RunTaskButton task="send-emails" label="Send all drafted emails" variant="default" />}
      </PageHeader>
      <PageBody>
        {!smtp && (
          <Alert>
            <AlertTitle>Emails can be sent from here</AlertTitle>
            <AlertDescription>Add a Gmail app password in <Link href="/settings#email" className="underline">Settings → Email</Link> to send with one click (and automatically, with autopilot).</AlertDescription>
          </Alert>
        )}
        <OutreachTable rows={rows} smtp={smtp} />
      </PageBody>
    </>
  )
}
