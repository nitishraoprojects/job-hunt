// Turn free-text locations into {city, country, remote_type} so the dashboard can filter.

const CITY_ALIASES = {
  Bengaluru: ["bengaluru", "bangalore", "blr"],
  Delhi: ["new delhi", "delhi"],
  Noida: ["noida", "greater noida"],
  Gurugram: ["gurugram", "gurgaon"],
  Hyderabad: ["hyderabad", "secunderabad"],
  Pune: ["pune"],
  Mumbai: ["mumbai", "navi mumbai", "thane", "bombay"],
  Chennai: ["chennai", "madras"],
  Kolkata: ["kolkata", "calcutta"],
  Ahmedabad: ["ahmedabad"],
  Jaipur: ["jaipur"],
  Chandigarh: ["chandigarh", "mohali", "panchkula"],
  Indore: ["indore"],
  Kochi: ["kochi", "cochin"],
  Coimbatore: ["coimbatore"],
  Trivandrum: ["trivandrum", "thiruvananthapuram"],
  Bhubaneswar: ["bhubaneswar"],
  Lucknow: ["lucknow"],
};
const NCR = new Set(["Delhi", "Noida", "Gurugram"]);

const COUNTRIES = {
  India: ["india", "karnataka", "maharashtra", "telangana", "uttar pradesh", "haryana", "tamil nadu", "kerala", "gujarat", "west bengal", "rajasthan", "punjab", "odisha"],
  "United States": ["united states", "usa", "u.s.", "us remote", "remote us", "remote - us", "san francisco", "new york", "seattle", "california", "texas", "boston", "austin", "chicago", "bay area", "los angeles", "denver", "atlanta", "washington", "foster city", "palo alto", "mountain view", "sunnyvale", "san jose", "menlo park", "redmond", "portland", "miami", "philadelphia"],
  "United Kingdom": ["united kingdom", "england", "london", "manchester", "edinburgh", "scotland"],
  Canada: ["canada", "toronto", "vancouver", "montreal", "ontario"],
  Germany: ["germany", "berlin", "munich", "hamburg", "deutschland"],
  Singapore: ["singapore"], UAE: ["dubai", "abu dhabi", "united arab emirates", "uae"],
  Netherlands: ["netherlands", "amsterdam"], Ireland: ["ireland", "dublin"], Australia: ["australia", "sydney", "melbourne"],
  France: ["france", "paris"], Spain: ["spain", "madrid", "barcelona"], Portugal: ["portugal", "lisbon"], Italy: ["italy", "milan"],
  Poland: ["poland", "warsaw", "krakow"], Austria: ["austria", "vienna"], Switzerland: ["switzerland", "zurich"],
  Sweden: ["sweden", "stockholm"], Denmark: ["denmark", "copenhagen"], Israel: ["israel", "tel aviv"],
  Brazil: ["brazil", "são paulo", "sao paulo"], Argentina: ["argentina", "buenos aires"], Mexico: ["mexico"],
  Japan: ["japan", "tokyo"], Thailand: ["thailand", "bangkok"], Vietnam: ["vietnam", "ho chi minh", "hanoi"],
  Philippines: ["philippines", "manila"], Indonesia: ["indonesia", "jakarta"], Malaysia: ["malaysia", "kuala lumpur"],
  China: ["china", "shanghai", "beijing", "shenzhen"], "Hong Kong": ["hong kong"], Korea: ["korea", "seoul"],
  Europe: ["europe", "emea"], Americas: ["americas", "latam", "north america"], APAC: ["apac", "asia pacific"],
};
const US_STATE = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const REMOTE_WORDS = /^(remote|anywhere|worldwide|global|work from home|wfh|hybrid|onsite|on-site|multiple locations|\s)*$/;

export function normalizeLocation(raw = "", hints = {}) {
  const loc = ` ${String(raw).toLowerCase().replace(/[()|/,;·-]/g, " ").replace(/\s+/g, " ")} `;
  const has = (k) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(loc);
  let city = null;
  for (const [name, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some(has)) { city = name; break; }
  }
  // Every country named; a listing open to India among others still counts as India.
  const named = Object.entries(COUNTRIES).filter(([, keys]) => keys.some(has)).map(([n]) => n);
  if (US_STATE.test(String(raw)) && !named.includes("United States")) named.push("United States");
  let country = city || named.includes("India") ? "India" : named[0] ?? hints.country ?? null;
  const remote = hints.remote || /remote|anywhere|work from home|wfh|distributed/.test(loc);
  const hybrid = hints.hybrid || /hybrid/.test(loc);
  const remote_type = remote ? "remote" : hybrid ? "hybrid" : "onsite";
  if (!country && /worldwide|anywhere|global/.test(loc)) country = "Worldwide";
  // Some place we don't recognise (and not just "Remote"): treat as outside India.
  if (!country && !REMOTE_WORDS.test(loc.trim())) country = "Other";
  return { city, country, remote_type, ncr: NCR.has(city) };
}

export const stripHtml = (html = "") =>
  String(html)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/<\/(p|li|h\d|div|ul|ol)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export function atsFromUrl(url = "") {
  if (/greenhouse\.io|gh_jid=/.test(url)) return "greenhouse";
  if (/lever\.co/.test(url)) return "lever";
  if (/ashbyhq\.com/.test(url)) return "ashby";
  if (/smartrecruiters\.com/.test(url)) return "smartrecruiters";
  if (/workable\.com/.test(url)) return "workable";
  if (/recruitee\.com/.test(url)) return "recruitee";
  if (/myworkdayjobs\.com/.test(url)) return "workday";
  if (/linkedin\.com/.test(url)) return "linkedin";
  if (/instahyre\.com/.test(url)) return "instahyre";
  return "other";
}
