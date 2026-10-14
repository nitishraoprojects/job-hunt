import { readFile } from "node:fs/promises"
import path from "node:path"
import { ROOT } from "@/lib/db"

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}
const ALLOWED_DIRS = ["resumes", "cover-letters"]

// Serves generated resumes and cover letters from the job-hunt folder.
export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("path") ?? ""
  const abs = path.resolve(ROOT, rel)
  const top = path.relative(ROOT, abs).split(path.sep)[0]
  if (!abs.startsWith(ROOT + path.sep) || !ALLOWED_DIRS.includes(top)) {
    return new Response("Not found", { status: 404 })
  }
  try {
    const body = await readFile(abs)
    return new Response(body, {
      headers: {
        "content-type": TYPES[path.extname(abs)] ?? "application/octet-stream",
        "content-disposition": `inline; filename="${path.basename(abs)}"`,
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
