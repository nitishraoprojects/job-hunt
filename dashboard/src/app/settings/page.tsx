import { PageBody, PageHeader } from "@/components/page-header"
import { SettingsForm } from "@/components/settings/settings-form"
import { readSettings, smtpConfigured } from "@/lib/settings"

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Autopilot, the answers used on application forms, and what to search for" />
      <PageBody><SettingsForm settings={readSettings()} smtp={smtpConfigured()} /></PageBody>
    </>
  )
}
