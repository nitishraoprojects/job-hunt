import { execFile } from "node:child_process";

// curl rather than fetch: curl honours the system proxy setup, Node's fetch does not.
export function get(url, { headers = {}, timeout = 30 } = {}) {
  const args = ["-sSL", "--compressed", "--max-time", String(timeout), "-w", "\n%{http_code}",
    "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36"];
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  args.push(url);
  return new Promise((resolve, reject) => {
    execFile("curl", args, { maxBuffer: 128 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error(`curl failed: ${url}`));
      const i = stdout.lastIndexOf("\n");
      const status = Number(stdout.slice(i + 1));
      if (status >= 400) return reject(Object.assign(new Error(`${status} ${url}`), { status }));
      resolve(stdout.slice(0, i));
    });
  });
}

export const getJson = async (url, opts) => JSON.parse(await get(url, opts));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run fn over items with limited concurrency.
export async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch (e) { out[idx] = { error: e }; }
    }
  }));
  return out;
}
