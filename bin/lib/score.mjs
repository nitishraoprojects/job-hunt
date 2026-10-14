// Heuristic 0-100 fit score so every listing is ranked the moment it lands.
// Claude's daily run refines scores for the top roles with a real read of the JD.

const has = (text, word) => {
  const w = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${w}`, "i").test(text);
};

function experienceRange(text) {
  const m = text.match(/(\d{1,2})\s*(?:\+|-|–|to)\s*(\d{1,2})?\s*\+?\s*(?:years|yrs)/i);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo + 4;
  return lo <= 20 && hi <= 30 ? [lo, hi] : null;
}

export function scoreJob(job, cfg) {
  const s = cfg.scoring;
  const title = ` ${job.title.toLowerCase()} `;
  const body = `${job.title} ${job.keywords ?? ""} ${job.jd ?? ""}`.toLowerCase();
  const reasons = [];
  let score = 30;

  // Title: the strongest signal, especially for listings without a JD yet.
  const bad = s.bad_titles.find((t) => title.includes(t));
  if (bad) { score -= 30; reasons.push(`title mentions "${bad.trim()}"`); }
  const good = s.good_titles.filter((t) => title.includes(t));
  if (good.length) { score += Math.min(20, 8 + good.length * 4); reasons.push(`title: ${good.map((g) => g.trim()).join(", ")}`); }
  if (/angular/.test(title)) score += 8;
  if (/senior|sr\.?|sde[ -]?(2|ii|3|iii)|lead/.test(title)) { score += 5; reasons.push("senior level"); }
  if (/junior|jr\.?|associate|entry/.test(title)) score -= 8;

  // Skills mentioned anywhere.
  const hits = Object.entries(s.skills).filter(([k]) => has(body, k));
  const skillPts = Math.min(30, hits.reduce((n, [, w]) => n + w, 0));
  score += skillPts;
  if (hits.length) reasons.push(`skills: ${hits.map(([k]) => k).slice(0, 6).join(", ")}`);

  // Experience band.
  const range = experienceRange(body);
  if (range) {
    const [lo, hi] = range;
    const y = s.years_experience;
    if (y >= lo && y <= hi + 1) { score += 6; reasons.push(`${lo}-${hi} yrs fits`); }
    else if (lo > y + 1) { score -= 15; reasons.push(`wants ${lo}+ yrs`); }
    else if (hi < y - 2) { score -= 6; reasons.push(`junior band ${lo}-${hi} yrs`); }
  }

  // Location.
  if (s.preferred_cities.includes(job.city)) { score += 10; reasons.push(`${job.city} (preferred)`); }
  else if (s.ok_cities.includes(job.city)) { score += 4; }
  else if (job.remote_type === "remote" && (!job.country || ["India", "Worldwide"].includes(job.country))) { score += 8; reasons.push("remote"); }
  else if (job.country && job.country !== "India") { score -= 25; reasons.push(`outside India (${job.country})`); }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}
