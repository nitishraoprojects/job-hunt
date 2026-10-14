#!/usr/bin/env node
// Send email outreach through your own mailbox (SMTP, e.g. Gmail with an app password).
//   node bin/send-email.mjs --id 7     send one draft
//   node bin/send-email.mjs --all      send every drafted email (autopilot uses this when auto_send_emails is on)
// Config: .env in the job-hunt folder with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { openDb, log, readJsonFile, ROOT } from "./lib/db.mjs";

const envPath = join(ROOT, ".env");
if (!existsSync(envPath)) { console.error("No .env with SMTP settings. See Settings → Email in the dashboard."); process.exit(1); }
const env = Object.fromEntries(readFileSync(envPath, "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST ?? "smtp.gmail.com", port: Number(env.SMTP_PORT ?? 465), secure: Number(env.SMTP_PORT ?? 465) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const db = openDb();
const fileName = (readJsonFile("profile/settings.json").answers.full_name || "Resume").trim().replace(/\s+/g, "_");
const argv = process.argv.slice(2);
const rows = argv.includes("--id")
  ? db.prepare("SELECT * FROM outreach WHERE id = ? AND channel = 'email'").all(Number(argv[argv.indexOf("--id") + 1]))
  : db.prepare("SELECT * FROM outreach WHERE channel = 'email' AND status = 'drafted' AND contact LIKE '%@%' LIMIT 20").all();

for (const o of rows) {
  const job = o.job_id ? db.prepare("SELECT * FROM jobs WHERE id = ?").get(o.job_id) : null;
  const resume = join(ROOT, job?.resume_pdf ?? "resumes/master/resume.pdf");
  try {
    await transport.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER, to: o.contact, subject: o.subject ?? `Application – ${job?.title ?? ""}`,
      text: o.body, attachments: existsSync(resume) ? [{ filename: `${fileName}_Resume.pdf`, path: resume }] : [],
    });
    db.prepare("UPDATE outreach SET status = 'sent', sent_at = datetime('now'), follow_up_on = date('now', '+5 days') WHERE id = ?").run(o.id);
    log(db, "outreach", `Emailed ${o.person_name ?? o.contact} (${o.company ?? ""})`);
    console.log(`✓ sent to ${o.contact}`);
  } catch (e) {
    log(db, "outreach", `Email to ${o.contact} failed: ${e.message}`);
    console.log(`✗ ${o.contact}: ${e.message}`);
  }
}
