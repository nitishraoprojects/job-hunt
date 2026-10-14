"use client"

import { useState } from "react"
import { DownloadIcon, FileTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { fileUrl } from "../jobs/bits"

type File = { path: string; name: string; modified: string }

export function ResumeBrowser({ groups }: { groups: { label: string; files: File[] }[] }) {
  const first = groups.flatMap((g) => g.files)[0]
  const [current, setCurrent] = useState<File | undefined>(first)
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.label} size="sm">
            <CardHeader><CardTitle className="text-sm">{g.label} ({g.files.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {g.files.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
              {g.files.map((f) => (
                <button key={f.path} onClick={() => setCurrent(f)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", current?.path === f.path && "bg-muted font-medium")}>
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="min-h-[80vh] py-0">
        {current ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">{current.name}</span>
              <Button size="sm" variant="outline" nativeButton={false} render={<a href={fileUrl(current.path)} download />}>
                <DownloadIcon data-icon="inline-start" /> Download
              </Button>
            </div>
            <iframe src={fileUrl(current.path)} className="h-full min-h-[75vh] w-full rounded-b-xl" title={current.name} />
          </>
        ) : <CardContent className="py-10 text-center text-muted-foreground">No files yet.</CardContent>}
      </Card>
    </div>
  )
}
