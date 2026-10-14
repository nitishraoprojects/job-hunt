// Answer memory: questions you answer on one form are reused on later forms that ask the
// same thing, even when the wording or company name differs.
//
// Stored in settings.custom_answers as { "<normalized question with {company}>": "<answer>" }.

export const normQ = (s = "") => s.toLowerCase()
  .replace(/\((locator|page|frame)\.[^)]*\)/g, "") // error text from older runs
  .replace(/\bselect\.\.\.?\s*$/g, "")              // react-select placeholder glued onto the label
  .replace(/\*/g, "").replace(/\s+/g, " ").trim();

// Yes/no questions generalize; open (free-text) ones don't.
const kind = (q) => (/(^|[,:;?]\s*)(are|do|does|did|have|has|had|will|would|is|was|were|can|could|should)\s+(you|your|there|any|anyone)\b/.test(q) ? "yesno" : "open");

const SUFFIXES = /\b(inc|inc\.|llc|ltd|limited|pvt|private|corp|corporation|co|technologies|technology|tech|software|solutions|labs|india|group|holdings)\b\.?/g;

function companyVariants(company = "") {
  const c = company.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const core = c.replace(SUFFIXES, "").replace(/\s+/g, " ").trim();
  const v = new Set([c, core, core.replace(/\s/g, ""), core.split(" ")[0]]);
  return [...v].filter((x) => x.length >= 3).sort((a, b) => b.length - a.length);
}

// Replace the employer's name with {company} so yes/no questions generalize across companies.
// Open questions ("why do you want to join X?") keep the name: those answers are company-specific.
export function template(question, company) {
  let q = normQ(question);
  if (kind(q) === "open") return q;
  for (const v of companyVariants(company)) {
    q = q.replace(new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(,? inc\\.?|'s)?\\b`, "g"), "{company}");
  }
  return q.replace(/(\{company\}\s*)+/g, "{company} ").replace(/\s+([?.,])/g, "$1").trim();
}

const STOP = new Set(("a an the you your yours are is was were be been do does did have has had any in at for of to or and " +
  "will would could should can now future ever before past currently this that these those role position job company " +
  "{company} please if yes no with by on from as it its we our us i me my may might what which who whom how when where " +
  "there their they them than then so such about into over under per via all also other others").split(" "));

// Words that mean the same thing on application forms.
const SYNONYMS = {
  employed: "work", employment: "work", employer: "work", worked: "work", working: "work", works: "work",
  relative: "family", relatives: "family", relation: "family", relationship: "family", relationships: "family",
  sponsorship: "sponsor", sponsored: "sponsor", visa: "sponsor", require: "need", requires: "need", required: "need",
  joined: "join", joining: "join", relocate: "relocat", relocation: "relocat", relocating: "relocat",
  salary: "compensation", ctc: "compensation", pay: "compensation", expected: "expect", expectation: "expect", expectations: "expect",
  authorised: "authoriz", authorized: "authoriz", authorization: "authoriz", eligible: "authoriz", legally: "legal",
  activities: "activity", activityies: "activity", ies: "", notice: "notice", period: "notice",
}
const stem = (w) => (w.length > 5 ? w.replace(/(ing|ed|es|s)$/, "") : w);

export function tokens(q) {
  return new Set(q.replace(/[^a-z0-9{} ]/g, " ").split(" ")
    .map((w) => (w in SYNONYMS ? SYNONYMS[w] : w))
    .filter((w) => w && !STOP.has(w)).map(stem));
}

const NEGATION = /\b(not|never|no longer|don't|do not|isn't|aren't|won't|without)\b/;

export function similarity(a, b) {
  // Free-text answers are only reused for the exact same question (handled by recall's exact lookup).
  if (kind(a) === "open" || kind(b) === "open") return 0;
  if (NEGATION.test(a) !== NEGATION.test(b)) return 0;
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  // One-concept questions must be about exactly the same thing; otherwise share at least two words.
  if (A.size === 1 && B.size === 1) return shared === 1 ? 1 : 0;
  if (shared < 2) return 0;
  // Mostly "how much of the shorter question is covered", tempered by overall overlap.
  const jaccard = shared / (A.size + B.size - shared);
  const coverage = shared / Math.min(A.size, B.size);
  return 0.4 * jaccard + 0.6 * coverage;
}

// Best remembered answer for this question. `fits(answer)` lets the caller reject answers
// that don't match the field's options (e.g. a dropdown without that choice).
export function recall(store, question, company, { fits = () => true, min = 0.45 } = {}) {
  const key = template(question, company);
  if (store[key] && fits(store[key])) return { answer: store[key], key, score: 1 };
  let best = null;
  for (const [k, answer] of Object.entries(store)) {
    const score = similarity(key, k);
    if (score >= min && (!best || score > best.score) && fits(answer)) best = { answer, key: k, score };
  }
  return best;
}
