import type { Metadata } from "next"
import { Suspense } from "react"
import "./globals.css"
import { AppSidebar } from "@/components/app-sidebar"
import { GlobalJobSheet } from "@/components/jobs/job-sheet"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { navCounts } from "@/lib/db"
import { readSettings } from "@/lib/settings"

export const metadata: Metadata = {
  title: "Job Hunt",
  description: "Automated job search pipeline",
}

export const dynamic = "force-dynamic"

export default function RootLayout({ children }: LayoutProps<"/">) {
  const counts = navCounts()
  const settings = readSettings()
  const autopilot = settings.autopilot.enabled
  counts.questions = settings.pending_questions?.length ?? 0
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background">
        <TooltipProvider>
          <SidebarProvider>
            <Suspense>
              <AppSidebar counts={counts} autopilot={autopilot} name={settings.answers.full_name ?? ""} />
            </Suspense>
            <SidebarInset className="min-w-0">{children}</SidebarInset>
            <Suspense><GlobalJobSheet /></Suspense>
          </SidebarProvider>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
