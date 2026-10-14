"use client"

import { useState, useTransition } from "react"
import { XIcon } from "lucide-react"
import { toast } from "sonner"
import { forgetAnswer, saveSettings, saveSmtp } from "@/app/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Settings } from "@/lib/settings"

const ANSWER_FIELDS: [string, string, string?][] = [
  ["full_name", "Full name"], ["first_name", "First name"], ["last_name", "Last name"], ["email", "Email"], ["phone", "Phone"],
  ["city", "City"], ["linkedin", "LinkedIn URL", "Many forms require this"], ["github", "GitHub URL"], ["website", "Portfolio / website"],
  ["current_company", "Current company"], ["current_title", "Current title"], ["years_experience", "Years of experience"],
  ["notice_period", "Notice period", "e.g. 60 days"], ["current_ctc", "Current CTC", "e.g. 18 LPA"], ["expected_ctc", "Expected CTC", "e.g. 28 LPA"],
  ["willing_to_relocate", "Willing to relocate"], ["needs_sponsorship", "Needs visa sponsorship"], ["how_did_you_hear", "How did you hear about us"],
  ["pitch", "Short pitch", "2–3 sentences used when a job has no tailored cover letter"],
]

export function SettingsForm({ settings, smtp }: { settings: Settings; smtp: boolean }) {
  const [s, setS] = useState(settings)
  const [pending, start] = useTransition()
  const save = (patch: Partial<Settings>, msg = "Saved") => start(async () => { await saveSettings(patch); toast.success(msg) })
  const auto = s.autopilot
  const setAuto = (k: keyof Settings["autopilot"], v: boolean | number) => {
    const next = { ...s, autopilot: { ...auto, [k]: v } }
    setS(next)
    save({ autopilot: next.autopilot })
  }
  const [mail, setMail] = useState({ user: s.answers.email ?? "", pass: "" })
  const missing = ["linkedin", "notice_period", "current_ctc", "expected_ctc"].filter((k) => !s.answers[k])

  return (
    <div className="grid max-w-4xl gap-6">
      <Card id="autopilot">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Autopilot <Badge variant={auto.enabled ? "default" : "outline"}>{auto.enabled ? "On" : "Off"}</Badge></CardTitle>
          <CardDescription>While the dashboard is running, autopilot fetches new listings, queues strong matches and applies to them on its own.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <Switch id="ap" checked={auto.enabled} onCheckedChange={(v) => setAuto("enabled", v)} />
              <Label htmlFor="ap">Run autopilot</Label>
            </Field>
            <Field orientation="horizontal">
              <Switch id="as" checked={auto.auto_submit} onCheckedChange={(v) => setAuto("auto_submit", v)} />
              <div>
                <Label htmlFor="as">Submit applications automatically</Label>
                <FieldDescription>Off = review mode: forms are filled and left open for you to submit.</FieldDescription>
              </div>
            </Field>
            <Field orientation="horizontal">
              <Switch id="ae" checked={auto.auto_send_emails} onCheckedChange={(v) => setAuto("auto_send_emails", v)} disabled={!smtp} />
              <div>
                <Label htmlFor="ae">Send drafted cold emails automatically</Label>
                <FieldDescription>{smtp ? "Uses your Gmail below." : "Set up email first."}</FieldDescription>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="ms">Auto-queue at fit score ≥</FieldLabel>
                <Input id="ms" type="number" min={40} max={100} value={auto.auto_queue_min_score} onChange={(e) => setS({ ...s, autopilot: { ...auto, auto_queue_min_score: Number(e.target.value) } })} onBlur={() => save({ autopilot: s.autopilot })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dl">Max applications per day</FieldLabel>
                <Input id="dl" type="number" min={1} max={200} value={auto.daily_apply_limit} onChange={(e) => setS({ ...s, autopilot: { ...auto, daily_apply_limit: Number(e.target.value) } })} onBlur={() => save({ autopilot: s.autopilot })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="fh">Refresh listings every (hours)</FieldLabel>
                <Input id="fh" type="number" min={1} max={48} value={auto.fetch_every_hours} onChange={(e) => setS({ ...s, autopilot: { ...auto, fetch_every_hours: Number(e.target.value) } })} onBlur={() => save({ autopilot: s.autopilot })} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card id="answers">
        <CardHeader>
          <CardTitle>Application answers</CardTitle>
          <CardDescription>Used to fill every application form. Keep these accurate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missing.length > 0 && (
            <Alert><AlertDescription>Fill in {missing.map((m) => ANSWER_FIELDS.find((f) => f[0] === m)?.[1]).join(", ")} — many forms require them and will be held for review without them.</AlertDescription></Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {ANSWER_FIELDS.map(([k, label, hint]) => (
              <Field key={k}>
                <FieldLabel htmlFor={k}>{label}</FieldLabel>
                <Input id={k} value={s.answers[k] ?? ""} placeholder={hint} onChange={(e) => setS({ ...s, answers: { ...s.answers, [k]: e.target.value } })} />
              </Field>
            ))}
          </div>
          {Object.keys(s.custom_answers ?? {}).length > 0 && (
            <div className="space-y-3 pt-4">
              <div>
                <h4 className="text-sm font-medium">Remembered answers</h4>
                <p className="text-xs text-muted-foreground">
                  Learned from what you chose on past forms and reused on similar questions — at any company ({"{company}"} stands for the employer). Edit or remove any that are wrong.
                </p>
              </div>
              {Object.entries(s.custom_answers ?? {}).map(([q, a]) => (
                <Field key={q}>
                  <div className="flex items-start gap-2">
                    <FieldLabel className="flex-1 font-normal first-letter:uppercase">{q}</FieldLabel>
                    <Button size="icon-xs" variant="ghost" aria-label="Forget this answer" onClick={() => start(async () => {
                      await forgetAnswer(q)
                      const { [q]: _removed, ...rest } = s.custom_answers ?? {}
                      void _removed
                      setS({ ...s, custom_answers: rest })
                      toast.success("Forgotten")
                    })}><XIcon /></Button>
                  </div>
                  <Input value={a} onChange={(e) => setS({ ...s, custom_answers: { ...s.custom_answers, [q]: e.target.value } })} />
                </Field>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter><Button disabled={pending} onClick={() => save({ answers: s.answers, custom_answers: s.custom_answers }, "Answers saved")}>Save answers</Button></CardFooter>
      </Card>

      <Card id="search">
        <CardHeader>
          <CardTitle>What to search for</CardTitle>
          <CardDescription>Keywords and locations used for LinkedIn and job boards. One per line.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="kw">Keywords</FieldLabel>
            <Textarea id="kw" rows={8} value={s.search.keywords.join("\n")} onChange={(e) => setS({ ...s, search: { ...s.search, keywords: e.target.value.split("\n") } })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="loc">Locations</FieldLabel>
            <Textarea id="loc" rows={8} value={s.search.locations.join("\n")} onChange={(e) => setS({ ...s, search: { ...s.search, locations: e.target.value.split("\n") } })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pc">Preferred cities (score boost)</FieldLabel>
            <Input id="pc" value={s.scoring.preferred_cities.join(", ")} onChange={(e) => setS({ ...s, scoring: { ...s.scoring, preferred_cities: e.target.value.split(",").map((x) => x.trim()) } })} />
          </Field>
          <Field orientation="horizontal" className="self-end">
            <Switch id="rem" checked={s.search.include_remote} onCheckedChange={(v) => setS({ ...s, search: { ...s.search, include_remote: v } })} />
            <Label htmlFor="rem">Include remote roles</Label>
          </Field>
        </CardContent>
        <CardFooter>
          <Button disabled={pending} onClick={() => save({
            search: { ...s.search, keywords: s.search.keywords.map((k) => k.trim()).filter(Boolean), locations: s.search.locations.map((k) => k.trim()).filter(Boolean) },
            scoring: s.scoring,
          }, "Search settings saved")}>Save search settings</Button>
        </CardFooter>
      </Card>

      <Card id="email">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Email sending <Badge variant={smtp ? "default" : "outline"}>{smtp ? "Connected" : "Not set up"}</Badge></CardTitle>
          <CardDescription>
            Cold emails go out from your own Gmail. Create an app password at myaccount.google.com/apppasswords (needs 2-step verification) and paste it here.
            It&apos;s stored only in the local .env file.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="su">Gmail address</FieldLabel>
            <Input id="su" value={mail.user} onChange={(e) => setMail({ ...mail, user: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="sp">App password</FieldLabel>
            <Input id="sp" type="password" value={mail.pass} placeholder={smtp ? "•••• saved" : "16 characters"} onChange={(e) => setMail({ ...mail, pass: e.target.value })} />
          </Field>
        </CardContent>
        <CardFooter>
          <Button disabled={pending || !mail.user || !mail.pass} onClick={() => start(async () => { await saveSmtp(mail.user, mail.pass); setMail({ ...mail, pass: "" }); toast.success("Email connected") })}>Save email settings</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
