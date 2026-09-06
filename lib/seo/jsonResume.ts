import { isPrivateMarker } from "../resume/resolve"
import type { Resume } from "../resume/schema"

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
}

/** "April 2016 - Present" → { startDate: "2016-04" }; unparseable shapes yield {}. */
export function parseDuration(duration: string): { startDate?: string; endDate?: string } {
  const [start, end] = duration.split(/\s*[-–]\s*/)

  const toIso = (part: string | undefined): string | undefined => {
    if (!part) return undefined
    const trimmed = part.trim()
    if (/^present$/i.test(trimmed)) return undefined
    if (/^\d{4}$/.test(trimmed)) return trimmed
    const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed)
    if (!match) return undefined
    const month = MONTHS[match[1].toLowerCase()]
    return month ? `${match[2]}-${month}` : undefined
  }

  const startDate = toIso(start)
  const endDate = toIso(end)
  const out: { startDate?: string; endDate?: string } = {}
  if (startDate) out.startDate = startDate
  if (endDate) out.endDate = endDate
  return out
}

/**
 * The resume in JSON Resume format (jsonresume.org) — the interchange schema
 * AI recruiting tools and resume parsers consume natively. Built from the
 * PUBLIC model only; locked fields are omitted, never placeholder-filled.
 */
export function jsonResume(resume: Resume) {
  const { basics } = resume

  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: basics.name,
      label: basics.role,
      url: basics.website,
      summary: basics.summary,
    },
    work: resume.work.map((entry) => ({
      ...(isPrivateMarker(entry.company) ? {} : { name: entry.company }),
      position: entry.position,
      ...parseDuration(entry.duration),
      highlights: entry.responsibilities,
      keywords: entry.technologies,
    })),
    education: resume.education.map((entry) => ({
      institution: entry.institution,
      area: entry.study,
      endDate: entry.year,
    })),
    skills: basics.skills.map((name) => ({ name })),
  }
}
