"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon, BriefcaseIcon, ChevronsUpDownIcon, ClipboardListIcon, DatabaseIcon, FileTextIcon, GraduationCapIcon,
  HomeIcon, KanbanIcon, SendIcon, SettingsIcon, ZapIcon,
} from "lucide-react"
import { ApplyMini } from "@/components/apply/apply-live"
import { CommandMenu } from "@/components/command-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type Item = { title: string; href: string; icon: React.ComponentType; count?: number; attention?: boolean }

export function AppSidebar({ counts, autopilot, name }: { counts: Record<string, number>; autopilot: boolean; name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "ME"
  const pathname = usePathname()
  const items: Item[] = [
    { title: "Home", href: "/", icon: HomeIcon },
    { title: "Jobs", href: "/jobs", icon: BriefcaseIcon },
    { title: "Apply", href: "/apply", icon: ZapIcon, count: counts.queue, attention: counts.questions > 0 },
    { title: "Tracker", href: "/tracker", icon: KanbanIcon },
    { title: "Applications", href: "/applications", icon: ClipboardListIcon, count: counts.applications },
    { title: "Outreach", href: "/outreach", icon: SendIcon, count: counts.outreach },
    { title: "Interview prep", href: "/prep", icon: GraduationCapIcon },
    { title: "Resumes", href: "/resumes", icon: FileTextIcon },
  ]
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BriefcaseIcon className="size-4" />
              </div>
              <span className="truncate font-semibold">Job Hunt</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <CommandMenu />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton isActive={isActive(item.href)} tooltip={item.title} render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.title}</span>
                    {item.attention && <span className="ml-auto size-2 rounded-full bg-amber-500" aria-label="Needs attention" />}
                  </SidebarMenuButton>
                  {item.count ? <SidebarMenuBadge className={cn(item.attention && "mr-3")}>{item.count.toLocaleString()}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <ApplyMini />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg">{initials}</AvatarFallback></Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name || "Your profile"}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", autopilot ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                    Autopilot {autopilot ? "on" : "off"}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>System</DropdownMenuLabel>
                  <DropdownMenuItem render={<Link href="/settings" />}><SettingsIcon /> Settings</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/settings#autopilot" />}><ZapIcon /> Autopilot</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/sources" />}><DatabaseIcon /> Job sources</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/activity" />}><ActivityIcon /> Activity log</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
