# Job hunt — operating playbook

This folder runs a personal job search. Code fetches, scores and applies; the daily Claude run adds judgment (scoring, tailoring, prep, outreach).
Dashboard: `npm run dashboard` → http://localhost:4321

## Layout
- `profile/profile.md` — facts about the user + open questions. **Only source of truth for resume content.**
- `profile/settings.json` — search keywords/locations, scoring weights, application-form answers (`answers`,
  `custom_answers`, `pending_questions`), and autopilot switches. The dashboard's Settings page edits this.
- `profile/boards.json` — company slugs per ATS (greenhouse/lever/ashby/smartrecruiters/workable/recruitee).
  `profile/companies.txt` + `node bin/discover-boards.mjs` finds more.
- `resumes/master/resume.md` — master resume. `resumes/tailored/<jobid>-<company>.md|.pdf`, `cover-letters/…`
- `data/jobhunt.db` — SQLite (schema `data/schema.sql` + `data/columns.json`). Tables: jobs, job_events, outreach, prep, activity, source_runs.
- `bin/fetch-jobs.mjs` — pulls LinkedIn (public search), Instahyre, Remotive, RemoteOK, Himalayas, Jobicy and every ATS board;
  dedupes, normalizes city/country/remote, scores (`bin/lib/score.mjs`).
- `bin/apply.mjs` — auto-apply engine (Playwright + system Chrome). Fills Greenhouse/Lever/Ashby forms from settings,
  uploads the job's tailored resume (or master), records unknown questions in `pending_questions`.
- `bin/autopilot.mjs` — fetch + auto-queue + apply + send emails, run every 15 min by the dashboard when enabled.
- `bin/rescore.mjs` — re-run location parsing + heuristic scoring over all jobs after changing scoring rules.
- `bin/send-email.mjs` — sends drafted email outreach over the user's SMTP (`.env`), only when the user triggers it or enables auto-send.
- `bin/jh` — CLI: `add-job`, `update-job`, `add-outreach`, `update-outreach`, `set-prep`, `log`, `list`, `query`, `render`.
  JSON goes in via a file or stdin (`-`).
- Dashboard: `npm run dashboard` → http://localhost:4321

## Hard rules
1. **Truthful tailoring.** Reword, reorder, emphasize, drop, and mirror the JD's vocabulary for skills the candidate actually has.
   Never invent employers, titles, dates, degrees, projects, certifications or numbers. If a JD needs something not in
   `profile.md`, list it as a gap in `fit_notes` and add it as an open question — don't put it on the resume.
2. **Claude never sends or submits itself.** Don't run `bin/apply.mjs`, `bin/autopilot.mjs` or `bin/send-email.mjs`, and
   don't submit forms in a browser. Those run from the user's dashboard/autopilot, which they control. Claude prepares:
   tailoring, queueing, answers, drafts.
3. **Quality over volume.** At most 10 jobs tailored and 20 outreach drafts per run. Each message names something
   specific (their team, product, a post they wrote). No generic mass blasts.
4. **Only public contact info.** Use emails that are published (job post, company site, the person's own pages).
   Never guess personal emails. If no email is public, use LinkedIn.
5. Questions for the user → `bin/jh log needs_input "<question>"` and add to Open questions in `profile.md`. Don't block on them.

## Daily run (do in order)
Listing fetches, scoring and form submission are handled by the code above. This run adds judgment:
1. **Inbox.** Search Gmail (last 3 days) for replies and application updates (interview invites, rejections,
   assessments). Update job/outreach statuses via `bin/jh` and log each. Interview invite → write/refresh prep.
2. **Refresh listings** if the last fetch is older than 6 hours: `node --no-warnings bin/fetch-jobs.mjs`.
3. **Re-score the top 40** unprocessed jobs (status found/saved, fit_score ≥ 65) by reading the JD against `profile.md`.
   Overwrite `fit_score` and `fit_notes` with real reasoning (fit, gaps, angle). Below 50 → `skipped`.
4. **Tailor** the 10 best (score ≥ 75) that have no `resume_pdf`: tailored resume + cover letter (render both, 1 page),
   `set-prep`, then `update-job` with the file paths and `status: "queued"` if the ATS is greenhouse/lever/ashby, else `"saved"`.
   Tailored files are what `bin/apply.mjs` uploads, so tailor before queueing.
5. **Pending questions.** For each entry in `settings.json → pending_questions`: if `profile.md` answers it truthfully,
   write the answer into `custom_answers` (keyed by the exact question text) and remove it from `pending_questions`.
   Otherwise leave it and log `needs_input`. Never invent experience to answer a question.
6. **Outreach** for newly tailored jobs: 2–3 people per company (manager/engineer/recruiter) via web search.
   LinkedIn referral note ≤ 300 chars (`channel: linkedin`); email only to publicly listed addresses (`channel: email`, status `drafted`).
7. **Follow-ups**: outreach `sent` with `follow_up_on <= today` and no reply → one short follow-up draft.
8. **Wrap up**: `bin/jh log run "<summary>"`.
