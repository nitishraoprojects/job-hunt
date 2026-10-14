import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Title + one-line purpose on the left, at most one primary action (plus quiet secondary ones) on the right.
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-5 pb-2 md:px-8 md:pt-8">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-1 flex-col gap-6 px-4 py-4 md:px-8 md:pb-10", className)}>{children}</div>
}

// Small uppercase label used above groups of content.
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  )
}
