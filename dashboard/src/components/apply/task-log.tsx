"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getTaskStatus } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Status = Awaited<ReturnType<typeof getTaskStatus>>

// Polls background task logs while anything is running.
export function TaskLog({ tasks }: { tasks: string[] }) {
  const [status, setStatus] = useState<Status>([])
  const router = useRouter()
  useEffect(() => {
    let wasRunning = false
    const tick = async () => {
      const s = (await getTaskStatus()).filter((t) => tasks.includes(t.name))
      setStatus(s)
      const running = s.some((t) => t.running)
      if (wasRunning && !running) router.refresh()
      wasRunning = running
    }
    tick()
    const t = setInterval(tick, 3000)
    return () => clearInterval(t)
  }, [tasks, router])

  const shown = status.filter((t) => t.tail || t.running)
  if (!shown.length) return null
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {shown.map((t) => (
        <Card key={t.name} size="sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{t.label}</CardTitle>
            <Badge variant={t.running ? "default" : "outline"}>{t.running ? "Running" : "Last run"}</Badge>
          </CardHeader>
          <CardContent>
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{t.tail || "Starting…"}</pre>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
