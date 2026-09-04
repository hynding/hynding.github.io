import { describe, it, expect } from "vitest"
import { loadResume, loadAudiences, readYamlIfPresent } from "@/lib/resume/load"

describe("loadResume", () => {
  it("parses and validates the real data file", () => {
    const resume = loadResume()
    expect(resume.basics.name).toBe("Steve Hynding")
    expect(resume.work.length).toBeGreaterThan(0)
  })

  it("gives every array entry a unique id", () => {
    const resume = loadResume()
    for (const list of [resume.work, resume.education]) {
      const ids = list.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("leaves education years as strings, not Dates", () => {
    for (const entry of loadResume().education) {
      expect(typeof entry.year).toBe("string")
    }
  })
})

describe("loadAudiences", () => {
  it("maps each audience to a list of tiers", () => {
    const audiences = loadAudiences()
    expect(audiences.recruiter).toContain("contact")
    expect(audiences.full).toContain("references")
  })
})

describe("readYamlIfPresent", () => {
  it("returns null for a file that does not exist", () => {
    expect(readYamlIfPresent("definitely-not-here.yaml")).toBeNull()
  })
})
