// Public job-board APIs of the ATS platforms most companies use.
// Each returns raw listings for one company slug.
import { getJson } from "../lib/http.mjs";
import { stripHtml } from "../lib/normalize.mjs";

export const ATS = {
  async greenhouse(co) {
    const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${co}/jobs?content=true`);
    return d.jobs.map((j) => ({
      external_id: `gh:${co}:${j.id}`, title: j.title, location: j.location?.name, url: j.absolute_url,
      apply_url: j.absolute_url, jd: stripHtml(j.content), posted_at: j.updated_at ?? j.first_published,
    }));
  },
  async lever(co) {
    const d = await getJson(`https://api.lever.co/v0/postings/${co}?mode=json`);
    return d.map((j) => ({
      external_id: `lv:${co}:${j.id}`, title: j.text, location: j.categories?.allLocations?.join(" / ") ?? j.categories?.location,
      url: j.hostedUrl, apply_url: j.applyUrl, posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      hints: { remote: j.workplaceType === "remote", hybrid: j.workplaceType === "hybrid" },
      jd: [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}\n${stripHtml(l.content)}`), j.additionalPlain].filter(Boolean).join("\n\n"),
    }));
  },
  async ashby(co) {
    const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${co}?includeCompensation=true`);
    return d.jobs.map((j) => ({
      external_id: `ab:${co}:${j.id}`, title: j.title,
      location: [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join(" / "),
      url: j.jobUrl, apply_url: j.applyUrl, jd: j.descriptionPlain, posted_at: j.publishedAt,
      salary: j.compensation?.compensationTierSummary, hints: { remote: j.isRemote || j.workplaceType === "Remote" },
    }));
  },
  async smartrecruiters(co) {
    const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${co}/postings?limit=100`);
    return d.content.map((j) => ({
      external_id: `sr:${co}:${j.id}`, title: j.name,
      location: [j.location?.city, j.location?.region, j.location?.country === "in" ? "India" : j.location?.country].filter(Boolean).join(", "),
      url: `https://jobs.smartrecruiters.com/${co}/${j.id}`, apply_url: `https://jobs.smartrecruiters.com/${co}/${j.id}`,
      posted_at: j.releasedDate, hints: { remote: j.location?.remote, hybrid: j.location?.hybrid },
    }));
  },
  async workable(co) {
    const d = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${co}`);
    return d.jobs.map((j) => ({
      external_id: `wk:${co}:${j.shortcode}`, title: j.title,
      location: [j.city, j.state, j.country].filter(Boolean).join(", "),
      url: j.url ?? j.shortlink, apply_url: j.application_url ?? j.url, posted_at: j.published_on ?? j.created_at,
      hints: { remote: j.telecommuting },
    }));
  },
  async recruitee(co) {
    const d = await getJson(`https://${co}.recruitee.com/api/offers/`);
    return d.offers.map((j) => ({
      external_id: `rc:${co}:${j.id}`, title: j.title, location: j.location, url: j.careers_url,
      apply_url: j.careers_apply_url, jd: stripHtml(`${j.description ?? ""}\n${j.requirements ?? ""}`),
      posted_at: j.published_at, hints: { remote: j.remote, hybrid: j.hybrid },
    }));
  },
};
