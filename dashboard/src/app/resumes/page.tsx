import { readdirSync, statSync, existsSync } from "node:fs"
import path from "node:path"
import { PageBody, PageHeader } from "@/components/page-header"
import { ResumeBrowser } from "@/components/resumes/resume-browser"
import { ROOT } from "@/lib/db"

function pdfs(dir: string) {
  const abs = path.join(ROOT, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs).filter((f) => f.endsWith(".pdf")).map((f) => ({
    path: `${dir}/${f}`, name: f.replace(/\.pdf$/, ""), modified: statSync(path.join(abs, f)).mtime.toISOString().slice(0, 16).replace("T", " "),
  }))
}

export default function ResumesPage() {
  const groups = [
    { label: "Master resume", files: pdfs("resumes/master") },
    { label: "Tailored resumes", files: pdfs("resumes/tailored") },
    { label: "Cover letters", files: pdfs("cover-letters") },
  ]
  return (
    <>
      <PageHeader title="Resumes" description="Master resume plus every tailored version and cover letter" />
      <PageBody><ResumeBrowser groups={groups} /></PageBody>
    </>
  )
}
