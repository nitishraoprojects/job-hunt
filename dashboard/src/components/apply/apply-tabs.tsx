"use client"

import { useState } from "react"
import { InboxIcon, MessageCircleQuestionIcon, ZapIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { JobRow } from "@/lib/db"
import { ApplyLive, useApplyProgress } from "./apply-live"
import { QueueTable } from "./queue-table"
import { QuestionsForm } from "./questions-form"

function Count({ n, alert }: { n: number; alert?: boolean }) {
  if (!n) return null
  return <Badge variant={alert ? "default" : "secondary"} className={alert ? "bg-amber-500 text-black" : ""}>{n}</Badge>
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function ApplyTabs({ initialTab, queue, review, questions }: {
  initialTab: string; queue: JobRow[]; review: JobRow[]; questions: string[]
}) {
  const [tab, setTab] = useState(initialTab)
  const progress = useApplyProgress(2000)
  const waiting = progress?.running && progress.current?.step === "waiting_for_you"

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="live" className="flex-none gap-1.5">
          Live {progress?.running && <span className={waiting ? "size-2 rounded-full bg-amber-500" : "size-2 animate-pulse rounded-full bg-emerald-500"} />}
        </TabsTrigger>
        <TabsTrigger value="queue" className="flex-none gap-1.5">Queue <Count n={queue.length} /></TabsTrigger>
        <TabsTrigger value="review" className="flex-none gap-1.5">Needs review <Count n={review.length} /></TabsTrigger>
        <TabsTrigger value="questions" className="flex-none gap-1.5">Questions <Count n={questions.length} alert /></TabsTrigger>
      </TabsList>

      <TabsContent value="live" className="pt-4">
        {progress && (progress.running || progress.items.length) ? <ApplyLive /> : (
          <EmptyState icon={<ZapIcon />} title="No run in progress"
            text={queue.length ? `${queue.length} jobs are queued. Press "Start auto-apply" and follow along here.` : "Queue jobs from the Jobs page, or turn on autopilot in Settings."} />
        )}
      </TabsContent>
      <TabsContent value="queue" className="pt-4">
        {queue.length ? <QueueTable rows={queue} /> : <EmptyState icon={<InboxIcon />} title="Queue is empty" text="Select jobs on the Jobs page and choose Auto-apply." />}
      </TabsContent>
      <TabsContent value="review" className="pt-4">
        {review.length ? <QueueTable rows={review} /> : <EmptyState icon={<InboxIcon />} title="Nothing to review" text="Jobs that couldn't be finished automatically show up here." />}
      </TabsContent>
      <TabsContent value="questions" className="pt-4">
        {questions.length ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Forms asked these and there was no saved answer. Answer once — every future form reuses it, and blocked jobs go back in the queue. Leave anything blank to skip it.</p>
            <QuestionsForm questions={questions} />
          </div>
        ) : <EmptyState icon={<MessageCircleQuestionIcon />} title="No open questions" text="New questions from application forms will appear here." />}
      </TabsContent>
    </Tabs>
  )
}
