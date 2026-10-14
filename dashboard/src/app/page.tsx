import Link from "next/link"
import { ArrowRightIcon, CircleIcon } from "lucide-react"
import { HomeJobRow, NextActionButton } from "@/components/home/home-bits"
import { PageBody, PageHeader, SectionTitle } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { all, one, stats, type JobRow } from "@/lib/db"
import { readSettings } from "@/lib/settings"

type Action = { title: string; detail: string; cta: string; href?: string; task?: string; done?: boolean }

export default function Home() {
  const s = stats()
  const settings = readSettings()
  const missingProfile = ["linkedin", "notice_period", "current_ctc", "expected_ctc"].filter((k) => !settings.answers[k])
  const questions = settings.pending_questions?.length ?? 0
  const strongNew = one<{ n: number }>(`SELECT count(*) n FROM jobs WHERE fit_score >= 75 AND status IN ('found','saved')
    AND (country = 'India' OR (remote_type = 'remote' AND country = 'Worldwide'))`)!.n

  // Ordered by what unblocks the most; the first unfinished one becomes the hero.
  const actions: Action[] = [
    { title: "Finish your application profile", detail: `Forms keep asking for ${missingProfile.length} details you haven't filled in yet.`, cta: "Complete profile", href: "/settings#answers", done: missingProfile.length === 0 },
    { title: `Answer ${questions} application question${questions === 1 ? "" : "s"}`, detail: "Answer once and every future form fills itself.", cta: "Answer questions", href: "/apply?tab=questions", done: questions === 0 },
    { title: `${s.queued} job${s.queued === 1 ? "" : "s"} waiting to be applied to`, detail: "Start a run and fill in anything it can't answer as it goes.", cta: "Start auto-apply", task: "apply-queue", done: s.queued === 0 },
    { title: `${strongNew} strong match${strongNew === 1 ? "" : "es"} to review`, detail: "Fit score 75+ in India or remote. Select the ones you like and auto-apply.", cta: "Review matches", href: "/jobs?view=best", done: strongNew === 0 },
    { title: `Send ${s.outreachDrafted} referral message${s.outreachDrafted === 1 ? "" : "s"}`, detail: "Drafted and personalised, ready to copy or send.", cta: "Open outreach", href: "/outreach", done: s.outreachDrafted === 0 },
  ]
  const hero = actions.find((a) => !a.done)
  const rest = actions.filter((a) => a !== hero && !a.done)

  const top = all<JobRow>(`SELECT id, title, company, logo, city, remote_type, fit_score, ats, status FROM jobs
    WHERE status IN ('found','saved') AND (country = 'India' OR (remote_type = 'remote' AND country = 'Worldwide'))
    ORDER BY fit_score DESC, created_at DESC LIMIT 6`)
  const pipeline = [
    { label: "Queued", n: s.queued, href: "/apply" },
    { label: "Applied", n: s.applied, href: "/applications" },
    { label: "Interviewing", n: s.interviewing, href: "/tracker" },
    { label: "Offers", n: s.offers, href: "/tracker" },
  ]
  const kpis = [
    { label: "New today", value: s.newToday, href: "/jobs?days=1" },
    { label: "Strong matches", value: s.relevant, href: "/jobs?view=best" },
    { label: "Applied", value: s.applied, href: "/applications" },
    { label: "Interviews", value: s.interviewing, href: "/tracker" },
  ]
  const hour = new Date().getHours()

  return (
    <>
      <PageHeader title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${settings.answers.first_name ? `, ${settings.answers.first_name}` : ""}`} description="Here's the one thing that moves your search forward right now." />
      <PageBody className="max-w-5xl">
        {hero ? (
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1 space-y-1">
                <div className="text-xs font-medium tracking-wide text-primary uppercase">Next step</div>
                <CardTitle className="text-xl">{hero.title}</CardTitle>
                <CardDescription>{hero.detail}</CardDescription>
              </div>
              <NextActionButton label={hero.cta} href={hero.href} task={hero.task} />
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="text-sm text-muted-foreground">You&apos;re all caught up. Autopilot will keep looking.</CardContent></Card>
        )}

        {rest.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Also to do</SectionTitle>
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {rest.map((a) => (
                <Link key={a.title} href={a.href ?? "/apply"} className="group flex items-center gap-3 rounded-md py-1.5 text-sm">
                  <CircleIcon className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate group-hover:underline">{a.title}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="rounded-xl border px-4 py-3 transition-colors hover:bg-muted/50">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{k.value.toLocaleString()}</div>
            </Link>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
          <section className="space-y-2">
            <SectionTitle action={<Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/jobs?view=best" />}>See all <ArrowRightIcon data-icon="inline-end" /></Button>}>
              Top matches for you
            </SectionTitle>
            <div className="divide-y rounded-xl border">
              {top.map((j) => <HomeJobRow key={j.id} job={j} />)}
            </div>
          </section>
          <section className="space-y-2">
            <SectionTitle>Pipeline</SectionTitle>
            <div className="space-y-1">
              {pipeline.map((p) => (
                <Link key={p.label} href={p.href} className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm hover:bg-muted">
                  <span>{p.label}</span>
                  <span className="font-semibold tabular-nums">{p.n}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </PageBody>
    </>
  )
}
