"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { runTask } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function RunTaskButton({ task, label, variant = "outline", icon = true }: {
  task: string; label: string; variant?: "default" | "outline" | "secondary" | "ghost"; icon?: boolean
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Button size="sm" variant={variant} disabled={pending} onClick={() => start(async () => {
      const r = await runTask(task)
      toast(r.started ? `${label} started — runs in the background` : `${label} is already running`)
      router.refresh()
    })}>
      {icon && <RefreshCwIcon data-icon="inline-start" className={pending ? "animate-spin" : ""} />}
      {label}
    </Button>
  )
}
