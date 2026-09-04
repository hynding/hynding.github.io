import { describe, it, expect } from "vitest"
import { resumeSchema, privateMarkerSchema } from "@/lib/resume/schema"

const validResume = {
  basics: {
    name: "Steve Hynding",
    role: "Full-stack Engineer / UX Specialist",
    website: "https://hynding.github.io",
    summary: "Experienced full-stack engineer with a strong background in UX design.",
    email: { private: "contact", public: "Available on request" },
    phone: { private: "contact", public: "Available on request" },
    skills: ["TypeScript", "React"],
  },
  work: [
    {
      id: "bcg",
      company: "Boston Consulting Group",
      position: "Lead Engineer (Full-stack)",
      duration: "April 2016 - Present",
      responsibilities: ["Built things."],
      technologies: ["Node.js"],
    },
  ],
  education: [
    { id: "lmu", institution: "Loyola Marymount University", year: "2000", study: "B.A. Film Production" },
  ],
  certifications: ["Meta Front-end Development (In-progress)"],
  references: { private: "references", public: "Available on request" },
}

describe("resumeSchema", () => {
  it("accepts a valid document", () => {
    expect(resumeSchema.parse(validResume)).toBeTruthy()
  })

  it("accepts a real value where a private marker is allowed", () => {
    const unlocked = { ...validResume, basics: { ...validResume.basics, email: "a@b.com" } }
    expect(resumeSchema.parse(unlocked).basics.email).toBe("a@b.com")
  })

  it("rejects an array entry with no id", () => {
    const noId = { ...validResume, work: [{ ...validResume.work[0], id: undefined }] }
    expect(() => resumeSchema.parse(noId)).toThrow()
  })

  it("rejects a Date, which is what an unquoted YAML date becomes", () => {
    const dated = {
      ...validResume,
      education: [{ ...validResume.education[0], year: new Date("2000-01-01") }],
    }
    expect(() => resumeSchema.parse(dated)).toThrow()
  })

  it("rejects duplicate ids within an array", () => {
    const dupes = { ...validResume, work: [validResume.work[0], { ...validResume.work[0] }] }
    expect(() => resumeSchema.parse(dupes)).toThrow(/duplicate id/)
  })

  it("rejects duplicate ids in a gated collection once unlocked", () => {
    const reference = { id: "a", name: "A", title: "T", contact: "c" }
    const dupes = { ...validResume, references: [reference, { ...reference }] }
    expect(() => resumeSchema.parse(dupes)).toThrow(/duplicate id/)
  })

  it("rejects an unknown tier in a private marker", () => {
    expect(() => privateMarkerSchema.parse({ private: "salary", public: "x" })).toThrow()
  })

  it("rejects a private marker with no public placeholder", () => {
    expect(() => privateMarkerSchema.parse({ private: "contact" })).toThrow()
  })
})
