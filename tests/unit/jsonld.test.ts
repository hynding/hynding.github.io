import { describe, it, expect } from "vitest"
import { personJsonLd } from "@/lib/seo/jsonld"
import type { Resume } from "@/lib/resume/schema"

const locked = {
  basics: {
    name: "Steve Hynding",
    role: "Lead Full-Stack Engineer",
    website: "https://hynding.github.io",
    summary: "Summary.",
    email: { private: "contact", public: "Available on request" },
    phone: { private: "contact", public: "Available on request" },
    skills: ["TypeScript", "React"],
  },
  work: [
    {
      id: "bcg",
      company: "Boston Consulting Group",
      position: "Lead Full-Stack Engineer",
      duration: "April 2016 - Present",
      responsibilities: ["Built things."],
      technologies: ["React"],
    },
  ],
  education: [{ id: "lmu", institution: "LMU", year: "2000", study: "B.A." }],
  certifications: [],
  references: { private: "references", public: "Available on request" },
} as unknown as Resume

describe("personJsonLd", () => {
  it("emits a schema.org Person with the public identity", () => {
    const ld = personJsonLd(locked)
    expect(ld["@context"]).toBe("https://schema.org")
    expect(ld["@type"]).toBe("Person")
    expect(ld.name).toBe("Steve Hynding")
    expect(ld.jobTitle).toBe("Lead Full-Stack Engineer")
    expect(ld.knowsAbout).toEqual(["TypeScript", "React"])
    expect(ld.worksFor).toMatchObject({ "@type": "Organization", name: "Boston Consulting Group" })
  })

  it("omits locked fields entirely rather than emitting placeholders", () => {
    const ld = personJsonLd(locked)
    expect(ld.email).toBeUndefined()
    expect(ld.telephone).toBeUndefined()
    expect(JSON.stringify(ld)).not.toMatch(/available on request/i)
    expect(JSON.stringify(ld)).not.toMatch(/references/i)
  })

  it("includes contact fields when they are public values", () => {
    const open = {
      ...locked,
      basics: { ...locked.basics, email: "a@b.com", phone: "+1 555 0100" },
    } as unknown as Resume
    const ld = personJsonLd(open)
    expect(ld.email).toBe("mailto:a@b.com")
    expect(ld.telephone).toBe("+1 555 0100")
  })

  it("omits worksFor when the employer is gated", () => {
    const gated = {
      ...locked,
      work: [{ ...locked.work[0], company: { private: "clients", public: "A consultancy" } }],
    } as unknown as Resume
    expect(personJsonLd(gated).worksFor).toBeUndefined()
  })
})
