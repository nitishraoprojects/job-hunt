# Job Hunt

A local, self-hosted job-search pipeline. It pulls thousands of listings from LinkedIn, Instahyre, remote-job boards and company career pages, ranks them against your profile, fills and submits applications for you, and tracks everything in a clean dashboard.

Everything runs on your machine. Your data lives in a local SQLite file and a few JSON/Markdown files. No accounts and no cloud service.

---

## What it does

| | |
|---|---|
| **Finds jobs** | LinkedIn public search, Instahyre, Remotive, RemoteOK, Himalayas, Jobicy, and the public career boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee) of 100+ companies. It deduplicates across sources and normalizes city, country and remote/hybrid/onsite. |
| **Ranks them** | Every listing gets a 0–100 fit score from your skills, seniority, location and title, with the reasons shown. |
| **Applies for you** | Opens each application form in Chrome, fills it from your saved answers, attaches your resume and submits. |
| **Waits for you when it must** | If a required question has no known answer, it keeps the window open, highlights the empty fields and waits. When you've filled them, it carries on. |
| **Learns your answers** | Anything you type or pick on a form is remembered and reused on later forms that ask the same thing, even at a different company or in different words. |
| **Tracks everything** | Tracker board, applications with response rate, outreach drafts, interview prep, tailored resumes, and a live view of the apply run. |

## Screens

- **Home**: the next thing that moves your search forward, a short to-do list, top matches and your pipeline.
- **Jobs**: views (All, Best matches, Delhi NCR, Remote, Shortlist), search, a filter panel (location, work type, fit, posted date, source), bulk actions.
- **Apply**: live progress of the current run (which job, which fields need you, how many done and remaining), the queue, jobs needing review, and questions to answer.
- **Tracker**: drag-and-drop board from shortlisted to offer.
- **Applications · Outreach · Interview prep · Resumes · Settings**
- **⌘K / Ctrl+K** anywhere: search any job or jump to any page.

---

## Quick start

**Requirements:** Node.js 22.5+ (uses the built-in `node:sqlite`), Google Chrome, and `curl`.

```bash
git clone https://github.com/<you>/job-hunt.git
cd job-hunt
npm run setup        # installs root + dashboard dependencies
npm run fetch-jobs   # first fetch takes a few minutes (LinkedIn is rate-limited)
npm run dashboard    # → http://localhost:4321
```

On first run the private files below are created from the committed examples. Fill them in:

| File | What goes in it |
|---|---|
| `profile/settings.json` | Your application answers (name, contact, notice period, CTC, links…), search keywords and locations, scoring weights, autopilot switches. Easiest to edit from **Settings** in the dashboard. |
| `profile/profile.md` | Facts about you. The only source the resume-tailoring step is allowed to draw from. |
| `resumes/master/resume.md` | Your master resume in Markdown. Render it with `bin/jh render resumes/master/resume.md`. |

If Chrome isn't at `/usr/bin/google-chrome`, set `CHROME_PATH`.

## Auto-apply

Queue jobs from the Jobs page (select → **Auto-apply**) and press **Start auto-apply**, or let autopilot queue them for you.

For each job the engine:

1. opens the form (Greenhouse, Lever and Ashby are fully supported; other sites get a best-effort generic fill),
2. fills every field it can answer, in this order: your remembered answer → your profile answers → the closest similar question you've answered before,
3. attaches the job's tailored resume and cover letter (or your master resume),
4. if anything required is still empty, highlights it and **waits for you** in the browser window, without scrolling the page while you work,
5. submits once everything has been filled and unchanged for a few seconds (or waits for you to click submit in review mode), then checks for the confirmation message.

Controls from the dashboard: **Submit now**, **I submitted it**, **Skip this job**, **Stop run**.

Settings → Autopilot:

- **Run autopilot**: while the dashboard is running, it refreshes listings and works through the queue every 15 minutes.
- **Submit automatically**: off means review mode (forms are filled, you click submit).
- **Auto-queue at fit score ≥**, **Max applications per day**, **Refresh every N hours**.

Without the dashboard, add a cron entry: `*/30 * * * * cd ~/job-hunt && node --no-warnings bin/autopilot.mjs`.

### Answer memory

When you answer a question the engine didn't know, it saves your answer:

- **Yes/no questions** are stored with the employer's name replaced by `{company}`, so "Have you worked for Okta before?" also answers "Have you ever worked at MongoDB?". Reworded versions match by meaning, using shared key terms and synonyms. Negated questions never match their opposites.
- **Open questions** ("Why do you want to join X?") are reused only for the same question at the same company.
- A remembered answer is only used if it fits the field's options.
- Review, edit or delete what it learned under **Settings → Remembered answers**.

### What it won't do

- Solve CAPTCHAs or hide that it's automated. A CAPTCHA is treated like an empty field and left to you.
- Use LinkedIn Easy Apply, since automating it risks your LinkedIn account.
- Tick declaration or consent checkboxes it has learned. You confirm those yourself.

---

## Daily AI run (optional)

`CLAUDE.md` is a playbook for a daily [Claude Code](https://claude.com/claude-code) run in this folder. It re-scores the top roles by actually reading the job descriptions, tailors resumes and cover letters (truthfully, from `profile.md` only), writes interview prep, answers pending form questions where your profile allows, and drafts referral and outreach messages. It prepares; it never sends or submits.

## Command line

| Command | |
|---|---|
| `npm run fetch-jobs` | Fetch every source (or `node bin/fetch-jobs.mjs linkedin ats …` for specific ones) |
| `npm run discover` | Probe the companies in `profile/companies.txt` for public career boards |
| `npm run rescore` | Re-run location parsing and scoring after changing scoring settings |
| `npm run apply` | Work through the apply queue |
| `bin/jh list [status]` · `bin/jh query "<sql>"` | Inspect the database |
| `bin/jh render <file.md>` | Markdown resume/cover letter → PDF |
| `node bin/send-email.mjs --all` | Send drafted cold emails through your SMTP (`.env`) |

## Project layout

```
bin/
  fetch-jobs.mjs        fetch → dedupe → normalize → score → upsert
  sources/              LinkedIn, Instahyre, remote boards, ATS career-board APIs
  apply.mjs             auto-apply engine (Playwright + your Chrome)
  autopilot.mjs         fetch + queue + apply + send, on a timer
  lib/answers.mjs       answer memory (templating, similarity, recall)
  lib/score.mjs         heuristic fit score
  lib/normalize.mjs     location → city / country / remote
  jh.mjs                CLI for the database and PDF rendering
dashboard/              Next.js + shadcn/ui
data/schema.sql         SQLite schema (database itself is git-ignored)
profile/                *.example.* templates are committed; your real files are not
```

## Privacy

`.gitignore` keeps everything personal out of git: `.env`, `profile/settings.json`, `profile/profile.md`, resumes, cover letters, the database, logs, form screenshots and the automation browser profile (which holds your logged-in sessions). Check `git status` before pushing a fork.

## Stack

Node.js (`node:sqlite`, Playwright core), Next.js 16, React 19, Tailwind CSS 4, shadcn/ui (Base UI), cmdk, nodemailer, marked.
