// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { ResumeProvider, useResume } from "@/components/shell/ResumeProvider"
import { sealVault } from "@/lib/vault/crypto"
import type { Resume } from "@/lib/resume/schema"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const resume = {
  basics: {
    name: "Steve Hynding",
    role: "Engineer",
    website: "https://example.com",
    summary: "Summary.",
    email: { private: "contact", public: "Available on request" },
    phone: { private: "contact", public: "Available on request" },
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
  references: { private: "references", public: "Available on request" },
} as unknown as Resume

function Probe({ onError }: { onError: (message: string) => void }) {
  const { unlock } = useResume()
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await unlock("test-passphrase")
        } catch (caught) {
          onError(caught instanceof Error ? caught.message : String(caught))
        }
      }}
    >
      go
    </button>
  )
}

describe("unlock validation failure", () => {
  it("reports a generic message and never the schema's internals", async () => {
    // A blob that decrypts cleanly but whose payload violates the schema.
    const blob = await sealVault("full", "test-passphrase", { basics: { email: 42 } })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(blob), { status: 200 })),
    )

    const seen: string[] = []
    render(
      <ResumeProvider resume={resume} audiences={["full"]}>
        <Probe onError={(message) => seen.push(message)} />
      </ResumeProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "go" }))

    await waitFor(() => expect(seen).toHaveLength(1), { timeout: 30_000 })
    expect(seen[0]).toBe("That link is out of date — ask for a new one.")
    expect(seen[0]).not.toMatch(/expected|received|zod/i)
  }, 30_000)
})
