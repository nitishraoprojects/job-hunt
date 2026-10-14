#!/usr/bin/env node
// Probe a big list of companies against public ATS job-board APIs and record the
// slugs that work in profile/boards.json. Re-run occasionally; add names to profile/companies.txt.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/db.mjs";
import { get, pool } from "./lib/http.mjs";

const PROBES = {
  greenhouse: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
  lever: (s) => `https://api.lever.co/v0/postings/${s}?mode=json&limit=1`,
  ashby: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
  smartrecruiters: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`,
  workable: (s) => `https://apply.workable.com/api/v1/widget/accounts/${s}`,
  recruitee: (s) => `https://${s}.recruitee.com/api/offers/`,
};

const names = readFileSync(join(ROOT, "profile", "companies.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

const variants = (name) => {
  const base = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]/g, "");
  return [...new Set([base.replace(/ /g, ""), base.replace(/ /g, "-"), `${base.replace(/ /g, "")}india`])];
};

const tasks = names.flatMap((n) => variants(n).flatMap((slug) => Object.keys(PROBES).map((ats) => ({ n, slug, ats }))));
const boardsPath = join(ROOT, "profile", "boards.json");
const boards = existsSync(boardsPath) ? JSON.parse(readFileSync(boardsPath, "utf8")) : {};
for (const ats of Object.keys(PROBES)) boards[ats] ??= [];

let found = 0;
await pool(tasks, 32, async ({ n, slug, ats }) => {
  if (boards[ats].includes(slug)) return;
  try {
    const body = await get(PROBES[ats](slug), { timeout: 15 });
    const d = JSON.parse(body);
    const count = Array.isArray(d) ? d.length : (d.jobs ?? d.content ?? d.offers ?? []).length;
    if (count > 0) { boards[ats].push(slug); found++; console.log(`${ats.padEnd(16)} ${slug}  (${n})`); }
  } catch { /* not on this ATS */ }
});

for (const ats of Object.keys(boards)) boards[ats] = [...new Set(boards[ats])].sort();
writeFileSync(boardsPath, JSON.stringify(boards, null, 2));
console.log(`\n${found} new boards. Total: ${Object.values(boards).flat().length}`);
