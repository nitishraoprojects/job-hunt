export const JOB_STATUSES = ["found", "saved", "queued", "applying", "tailored", "ready", "applied", "interviewing", "offer", "rejected", "skipped"] as const
export const OUTREACH_STATUSES = ["drafted", "in_gmail", "sent", "replied", "referred", "no_reply"] as const

// Tracker board columns, in pipeline order.
export const BOARD = [
  { status: "saved", label: "Shortlisted" },
  { status: "queued", label: "Queued to apply" },
  { status: "ready", label: "Needs review" },
  { status: "applied", label: "Applied" },
  { status: "interviewing", label: "Interviewing" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
] as const

export const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
