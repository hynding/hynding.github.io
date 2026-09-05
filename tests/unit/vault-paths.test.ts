import { describe, it, expect } from "vitest"
import { findMarkers, getAtPath, setAtPath } from "@/lib/vault/paths"

const doc = {
  basics: { name: "S", email: { private: "contact", public: "On request" } },
  work: [
    { id: "bcg", company: "BCG" },
    { id: "acme", company: { private: "clients", public: "A retailer" } },
  ],
  references: { private: "references", public: "On request" },
}

describe("findMarkers", () => {
  it("finds every marker with its path and tier", () => {
    const found = findMarkers(doc)
    expect(found).toHaveLength(3)
    expect(found.map((m) => m.tier).sort()).toEqual(["clients", "contact", "references"])
  })

  it("addresses array entries by id, not index", () => {
    const acme = findMarkers(doc).find((m) => m.tier === "clients")!
    expect(acme.path).toEqual(["work", { id: "acme" }, "company"])
  })
})

describe("getAtPath", () => {
  it("reads a nested value", () => {
    expect(getAtPath({ basics: { email: "a@b.c" } }, ["basics", "email"])).toBe("a@b.c")
  })

  it("reads through an array by id", () => {
    const source = { work: [{ id: "acme", company: "Acme Inc" }] }
    expect(getAtPath(source, ["work", { id: "acme" }, "company"])).toBe("Acme Inc")
  })

  it("returns undefined for a missing path", () => {
    expect(getAtPath({ a: 1 }, ["b", "c"])).toBeUndefined()
  })

  it("returns undefined for an id that is absent", () => {
    expect(getAtPath({ work: [{ id: "x" }] }, ["work", { id: "y" }, "company"])).toBeUndefined()
  })
})

describe("setAtPath", () => {
  it("creates intermediate objects", () => {
    const out = {}
    setAtPath(out, ["basics", "email"], "a@b.c")
    expect(out).toEqual({ basics: { email: "a@b.c" } })
  })

  it("creates an array and an id-bearing entry", () => {
    const out = {}
    setAtPath(out, ["work", { id: "acme" }, "company"], "Acme Inc")
    expect(out).toEqual({ work: [{ id: "acme", company: "Acme Inc" }] })
  })

  it("adds to an existing entry rather than duplicating it", () => {
    const out = {}
    setAtPath(out, ["work", { id: "acme" }, "company"], "Acme Inc")
    setAtPath(out, ["work", { id: "acme" }, "sector"], "Retail")
    expect(out).toEqual({ work: [{ id: "acme", company: "Acme Inc", sector: "Retail" }] })
  })

  it("sets a top-level key", () => {
    const out = {}
    setAtPath(out, ["references"], [{ id: "a", name: "A" }])
    expect(out).toEqual({ references: [{ id: "a", name: "A" }] })
  })

  it("walks two levels of array nesting", () => {
    const out = {}
    setAtPath(out, ["projects", { id: "p1" }, "outcomes", { id: "o1" }, "value"], "40 countries")
    expect(out).toEqual({
      projects: [{ id: "p1", outcomes: [{ id: "o1", value: "40 countries" }] }],
    })
  })

  it("throws rather than silently dropping a value when the path ends with an id", () => {
    expect(() => setAtPath({}, ["work", { id: "acme" }], { company: "Acme" })).toThrow(/end with/)
  })

  it("throws rather than writing to the root when the path starts with an id", () => {
    expect(() => setAtPath({}, [{ id: "x" }, "a"], 1)).toThrow(/start with/)
  })

  it("throws on an empty path", () => {
    expect(() => setAtPath({}, [], 1)).toThrow(/empty/)
  })
})
