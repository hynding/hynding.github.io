import { describe, it, expect } from "vitest"
import { resolve, isPrivateMarker } from "@/lib/resume/resolve"

describe("resolve", () => {
  it("returns the placeholder and reports locked for a marker", () => {
    const out = resolve({ private: "contact", public: "Available on request" })
    expect(out).toEqual({ value: "Available on request", locked: true })
  })

  it("returns the real value and reports unlocked for a plain value", () => {
    expect(resolve("steve@example.com")).toEqual({ value: "steve@example.com", locked: false })
  })

  it("passes an array through unlocked", () => {
    const refs = [{ id: "a", name: "A", title: "T", contact: "c" }]
    const out = resolve(refs)
    expect(out.locked).toBe(false)
    expect(out.value).toEqual(refs)
  })
})

describe("isPrivateMarker", () => {
  it.each([
    ["an array", []],
    ["null", null],
    ["a string", "x"],
    ["an object missing public", { private: "contact" }],
    ["an object whose public is not a string", { private: "contact", public: 1 }],
  ])("rejects %s", (_label, value) => {
    expect(isPrivateMarker(value)).toBe(false)
  })
})
