import { describe, it, expect } from "vitest"
import { buildVaults } from "@/lib/vault/build"
import { openVault } from "@/lib/vault/crypto"

const TIMEOUT = 30_000

const resume = {
  basics: {
    name: "Steve Hynding",
    role: "Engineer",
    website: "https://example.com",
    summary: "Summary.",
    email: { private: "contact", public: "On request" },
    phone: { private: "contact", public: "On request" },
    skills: ["TypeScript"],
  },
  work: [
    {
      id: "bcg",
      company: "Boston Consulting Group",
      position: "Lead Engineer",
      duration: "2016 - Present",
      responsibilities: ["Built things."],
      technologies: ["React"],
    },
  ],
  education: [{ id: "lmu", institution: "LMU", year: "2000", study: "B.A." }],
  certifications: [],
  references: { private: "references", public: "On request" },
}

const patch = {
  basics: { email: "steve@example.com", phone: "+1 555 0100" },
  references: [{ id: "a", name: "A Person", title: "Director", contact: "a@example.com" }],
}

const audiences = { recruiter: ["contact"], full: ["contact", "references"] } as const
const passphraseFor = () => "test-passphrase"

describe("buildVaults", () => {
  it("gives each audience only the tiers it is entitled to", async () => {
    const blobs = await buildVaults({ resume, patch, audiences, passphraseFor })

    const recruiter = (await openVault(blobs.recruiter, "test-passphrase")) as typeof patch
    expect(recruiter.basics.email).toBe("steve@example.com")
    expect(recruiter.references).toBeUndefined()

    const full = (await openVault(blobs.full, "test-passphrase")) as typeof patch
    expect(full.references).toHaveLength(1)
  }, TIMEOUT)

  it("throws when a declared marker has no private value", async () => {
    const incomplete = { basics: { email: "steve@example.com" } }
    await expect(
      buildVaults({ resume, patch: incomplete, audiences, passphraseFor }),
    ).rejects.toThrow(/phone/)
  }, TIMEOUT)

  it("throws when the merged document would violate the schema", async () => {
    const wrongType = { ...patch, basics: { ...patch.basics, email: 42 } }
    await expect(
      buildVaults({ resume, patch: wrongType, audiences, passphraseFor }),
    ).rejects.toThrow()
  }, TIMEOUT)

  it("throws when an audience has no passphrase", async () => {
    await expect(
      buildVaults({ resume, patch, audiences, passphraseFor: () => undefined }),
    ).rejects.toThrow(/passphrase/i)
  }, TIMEOUT)

  it("returns nothing when there is no patch at all", async () => {
    const blobs = await buildVaults({ resume, patch: null, audiences, passphraseFor })
    expect(blobs).toEqual({})
  })
})
