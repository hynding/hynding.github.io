import { describe, it, expect } from "vitest"
import { jsonResume, parseDuration } from "@/lib/seo/jsonResume"
import type { Resume } from "@/lib/resume/schema"

const resume = {
  basics: {
    name: "Steve Hynding",
    role: "Lead Full-Stack Engineer",
    website: "https://hynding.github.io",
    summary: "Summary.",
    email: { private: "contact", public: "Available on request" },
    phone: { private: "contact", public: "Available on request" },
    skills: ["TypeScript"],
  },
  work: [
    {
      id: "bcg",
      company: "Boston Consulting Group",
      position: "Lead Full-Stack Engineer",
      duration: "April 2016 - Present",
      responsibilities: ["Built things.", "Shipped things."],
      technologies: ["React", "AWS"],
    },
  ],
  education: [{ id: "lmu", institution: "LMU", year: "2000", study: "B.A. Film Production" }],
  certifications: [],
  references: { private: "references", public: "Available on request" },
} as unknown as Resume

describe("parseDuration", () => {
  it("parses 'Month YYYY - Present' into a start date only", () => {
    expect(parseDuration("April 2016 - Present")).toEqual({ startDate: "2016-04" })
  })
  it("parses a closed range", () => {
    expect(parseDuration("March 2012 - June 2015")).toEqual({ startDate: "2012-03", endDate: "2015-06" })
  })
  it("parses bare years", () => {
    expect(parseDuration("2012 - 2015")).toEqual({ startDate: "2012", endDate: "2015" })
  })
  it("returns nothing for a shape it cannot parse", () => {
    expect(parseDuration("a while ago")).toEqual({})
  })
})

describe("jsonResume", () => {
  it("emits the JSON Resume shape from public data", () => {
    const cv = jsonResume(resume)
    expect(cv.basics).toMatchObject({
      name: "Steve Hynding",
      label: "Lead Full-Stack Engineer",
      url: "https://hynding.github.io",
    })
    expect(cv.work[0]).toMatchObject({
      name: "Boston Consulting Group",
      position: "Lead Full-Stack Engineer",
      startDate: "2016-04",
      highlights: ["Built things.", "Shipped things."],
    })
    expect(cv.skills).toEqual([{ name: "TypeScript" }])
    expect(cv.education[0]).toMatchObject({ institution: "LMU", area: "B.A. Film Production" })
  })

  it("never carries a locked value or its placeholder", () => {
    const body = JSON.stringify(jsonResume(resume))
    expect(body).not.toMatch(/available on request/i)
    expect(body).not.toContain("email")
    expect(body).not.toContain("phone")
  })

  it("omits a gated employer name but keeps the role", () => {
    const gated = {
      ...resume,
      work: [{ ...resume.work[0], company: { private: "clients", public: "A consultancy" } }],
    } as unknown as Resume
    const entry = jsonResume(gated).work[0]
    expect(entry.name).toBeUndefined()
    expect(entry.position).toBe("Lead Full-Stack Engineer")
  })
})

describe("parseDuration with abbreviated months", () => {
  it("parses LinkedIn-style short month names", () => {
    expect(parseDuration("Mar 2026 - Present")).toEqual({ startDate: "2026-03" })
    expect(parseDuration("Feb 2025 - Dec 2025")).toEqual({ startDate: "2025-02", endDate: "2025-12" })
  })
})

describe("jsonResume with location and profiles", () => {
  const located = {
    ...resume,
    basics: {
      ...resume.basics,
      location: "Los Angeles, CA",
      profiles: [
        { id: "linkedin", network: "LinkedIn", url: "https://www.linkedin.com/in/stevehynding" },
      ],
    },
  } as unknown as Resume

  it("emits JSON Resume location and profiles", () => {
    const cv = jsonResume(located)
    expect(cv.basics.location).toEqual({ city: "Los Angeles", region: "CA" })
    expect(cv.basics.profiles).toEqual([
      { network: "LinkedIn", url: "https://www.linkedin.com/in/stevehynding" },
    ])
  })

  it("omits both when absent", () => {
    const cv = jsonResume(resume)
    expect(cv.basics.location).toBeUndefined()
    expect(cv.basics.profiles).toBeUndefined()
  })
})
