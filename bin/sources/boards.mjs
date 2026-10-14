// Job boards and aggregators searched by keyword.
import { get, getJson, sleep } from "../lib/http.mjs";
import { stripHtml } from "../lib/normalize.mjs";

const unescape = (s = "") => stripHtml(s).replace(/\s+/g, " ").trim();

// LinkedIn's public (logged-out) job search. Cards only; the JD is fetched later for top matches.
export async function linkedin(cfg, onError) {
  const { keywords, locations, include_remote, linkedin_pages = 4, linkedin_days = 14 } = cfg.search;
  const searches = [];
  for (const k of keywords) {
    for (const l of locations) searches.push({ k, l, extra: "" });
    if (include_remote) searches.push({ k, l: "India", extra: "&f_WT=2" });
  }
  const out = [];
  for (const { k, l, extra } of searches) {
    for (let page = 0; page < linkedin_pages; page++) {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(k)}`
        + `&location=${encodeURIComponent(l)}&f_TPR=r${linkedin_days * 86400}${extra}&start=${page * 25}`;
      let html;
      try { html = await get(url); } catch (e) {
        onError?.(e);
        if (e.status === 429) await sleep(20000);
        break;
      }
      const cards = html.split("<li>").slice(1);
      for (const c of cards) {
        const id = c.match(/jobPosting:(\d+)/)?.[1];
        if (!id) continue;
        out.push({
          external_id: `li:${id}`,
          title: unescape(c.match(/base-search-card__title">([\s\S]*?)<\/h3>/)?.[1]),
          company: unescape(c.match(/base-search-card__subtitle">([\s\S]*?)<\/h4>/)?.[1]),
          location: unescape(c.match(/job-search-card__location">([\s\S]*?)<\/span>/)?.[1]),
          posted_at: c.match(/datetime="([\d-]+)"/)?.[1],
          salary: unescape(c.match(/job-search-card__salary-info">([\s\S]*?)<\/span>/)?.[1]) || null,
          logo: c.match(/data-delayed-url="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&"),
          url: `https://www.linkedin.com/jobs/view/${id}/`,
          hints: { remote: extra.includes("f_WT=2") },
        });
      }
      if (cards.length < 10) break;
      await sleep(1200);
    }
  }
  return out;
}

// Full LinkedIn job description + the external apply link when the posting has one.
export async function linkedinDetail(id) {
  const html = await get(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  const jd = stripHtml(html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
  // Logged-out pages hide the external URL but still mark offsite applications with this icon.
  const offsite = /offsite-apply-icon/.test(html);
  const criteria = [...html.matchAll(/description__job-criteria-text[^>]*>([\s\S]*?)<\/span>/g)].map((m) => unescape(m[1]));
  return { jd, easy_apply: !offsite, seniority: criteria[0] ?? null };
}

export async function instahyre(cfg) {
  const out = [];
  let retries = 0;
  for (const skill of cfg.search.instahyre_skills ?? []) {
    for (let offset = 0; offset < 700; offset += 35) {
      let d;
      try {
        d = await getJson(`https://www.instahyre.com/api/v1/job_search?skills=${encodeURIComponent(skill)}&limit=35&offset=${offset}`);
      } catch (e) {
        if (e.status !== 429 || ++retries > 8) break;
        await sleep(15000);
        offset -= 35;
        continue;
      }
      for (const j of d.objects) {
        out.push({
          external_id: `ih:${j.id}`, title: j.title, company: j.employer?.company_name, location: j.locations,
          url: j.public_url, keywords: (j.keywords ?? []).join(", "), logo: j.employer?.profile_image_src,
          hints: { country: "India" },
        });
      }
      if (!d.meta?.next) break;
      await sleep(1500);
    }
  }
  return out;
}

export async function remotive() {
  const out = [];
  for (const term of ["angular", "typescript", "frontend", "full stack", "node"]) {
    const d = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}`);
    for (const j of d.jobs) {
      out.push({
        external_id: `rm:${j.id}`, title: j.title, company: j.company_name, location: `Remote ${j.candidate_required_location ?? ""}`,
        url: j.url, jd: stripHtml(j.description), posted_at: j.publication_date, salary: j.salary || null,
        logo: j.company_logo, keywords: (j.tags ?? []).join(", "), hints: { remote: true },
      });
    }
  }
  return out;
}

export async function remoteok() {
  const d = await getJson("https://remoteok.com/api");
  return d.filter((j) => j.id).map((j) => ({
    external_id: `ro:${j.id}`, title: j.position, company: j.company, location: `Remote ${j.location ?? ""}`,
    url: j.url, apply_url: j.apply_url, jd: stripHtml(j.description), posted_at: j.date,
    salary: j.salary_min ? `$${j.salary_min}–${j.salary_max}` : null, logo: j.company_logo || j.logo,
    keywords: (j.tags ?? []).join(", "), hints: { remote: true },
  }));
}

export async function himalayas() {
  const out = [];
  for (let offset = 0; offset < 1000; offset += 20) {
    const d = await getJson(`https://himalayas.app/jobs/api?limit=20&offset=${offset}`);
    if (!d.jobs?.length) break;
    for (const j of d.jobs) {
      out.push({
        external_id: `hm:${j.guid}`, title: j.title, company: j.companyName,
        location: `Remote ${(j.locationRestrictions ?? []).join(" / ")}`, url: j.applicationLink ?? j.guid,
        jd: stripHtml(j.description), posted_at: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
        logo: j.companyLogo, keywords: (j.categories ?? []).join(", "), hints: { remote: true },
      });
    }
    await sleep(300);
  }
  return out;
}

export async function jobicy() {
  const out = [];
  for (const tag of ["angular", "typescript", "javascript", "node", "frontend"]) {
    const d = await getJson(`https://jobicy.com/api/v2/remote-jobs?count=100&tag=${tag}`);
    for (const j of d.jobs ?? []) {
      out.push({
        external_id: `jc:${j.id}`, title: unescape(j.jobTitle), company: j.companyName, location: `Remote ${j.jobGeo ?? ""}`,
        url: j.url, jd: stripHtml(j.jobDescription), posted_at: j.pubDate, logo: j.companyLogo, hints: { remote: true },
      });
    }
  }
  return out;
}
