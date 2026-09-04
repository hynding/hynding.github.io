import { describe, it, expect } from "vitest"
import { merge } from "@/lib/resume/merge"

describe("merge", () => {
  it("replaces a scalar", () => {
    expect(merge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  it("merges nested objects without dropping siblings", () => {
    expect(merge({ a: { b: 1, c: 2 } }, { a: { b: 9 } })).toEqual({ a: { b: 9, c: 2 } })
  })

  it("replaces a private marker with a real value", () => {
    const base = { email: { private: "contact", public: "Available on request" } }
    expect(merge(base, { email: "steve@example.com" })).toEqual({ email: "steve@example.com" })
  })

  it("replaces a private marker with a whole array", () => {
    const base = { references: { private: "references", public: "On request" } }
    const refs = [{ id: "a", name: "A" }]
    expect(merge(base, { references: refs })).toEqual({ references: refs })
  })

  it("applies array patches by id regardless of order", () => {
    const base = { work: [{ id: "x", company: "X" }, { id: "y", company: "Y" }] }
    const out = merge(base, { work: [{ id: "y", company: "Real Y" }] }) as typeof base
    expect(out.work).toEqual([{ id: "x", company: "X" }, { id: "y", company: "Real Y" }])
  })

  it("still targets the right entry after the base is reordered", () => {
    const reordered = { work: [{ id: "y", company: "Y" }, { id: "x", company: "X" }] }
    const out = merge(reordered, { work: [{ id: "y", company: "Real Y" }] }) as typeof reordered
    expect(out.work.find((e) => e.id === "y")!.company).toBe("Real Y")
    expect(out.work.find((e) => e.id === "x")!.company).toBe("X")
  })

  it("appends an entry whose id is absent from the base", () => {
    const base = { projects: [{ id: "public-1", title: "P1" }] }
    const out = merge(base, { projects: [{ id: "secret-1", title: "S1" }] }) as typeof base
    expect(out.projects).toHaveLength(2)
    expect(out.projects[1]).toEqual({ id: "secret-1", title: "S1" })
  })

  it("does not mutate the base", () => {
    const base = { work: [{ id: "x", company: "X" }] }
    merge(base, { work: [{ id: "x", company: "Changed" }] })
    expect(base.work[0].company).toBe("X")
  })

  it("throws when an array entry in the patch has no id", () => {
    expect(() => merge({ work: [{ id: "x" }] }, { work: [{ company: "no id" }] })).toThrow(/id/)
  })

  it("throws on an id-less entry even when the base holds a private marker", () => {
    const base = { references: { private: "references", public: "On request" } }
    expect(() => merge(base, { references: [{ name: "no id" }] })).toThrow(/id/)
  })

  it("returns the base untouched for an undefined patch", () => {
    const base = { work: [{ id: "x", company: "X" }] }
    const out = merge(base, undefined)
    expect(out).toEqual(base)
    expect(base.work[0].company).toBe("X")
  })

  it("lets a null patch value replace a public value", () => {
    expect(merge({ a: 1 }, { a: null })).toEqual({ a: null })
  })
})
