import { describe, it, expect } from "vitest"
import { sealVault, openVault, generatePassphrase, KDF_ITERATIONS } from "@/lib/vault/crypto"

// PBKDF2 at 600k iterations is deliberately slow; give these room.
const TIMEOUT = 30_000

describe("vault crypto", () => {
  it("round-trips a payload", async () => {
    const payload = { basics: { email: "steve@example.com" } }
    const blob = await sealVault("recruiter", "correct-passphrase", payload)
    expect(await openVault(blob, "correct-passphrase")).toEqual(payload)
  }, TIMEOUT)

  it("rejects a wrong passphrase rather than returning garbage", async () => {
    const blob = await sealVault("recruiter", "right", { a: 1 })
    await expect(openVault(blob, "wrong")).rejects.toThrow()
  }, TIMEOUT)

  it("records the KDF parameters in the blob so it is self-describing", async () => {
    const blob = await sealVault("recruiter", "p", { a: 1 })
    expect(blob.kdf.iterations).toBe(KDF_ITERATIONS)
    expect(blob.kdf.hash).toBe("SHA-256")
    expect(blob.v).toBe(1)
  }, TIMEOUT)

  it("uses a fresh salt and iv per seal", async () => {
    const [a, b] = await Promise.all([
      sealVault("recruiter", "p", { a: 1 }),
      sealVault("recruiter", "p", { a: 1 }),
    ])
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.iv).not.toBe(b.iv)
  }, TIMEOUT)

  it("detects a tampered ciphertext", async () => {
    const blob = await sealVault("recruiter", "p", { a: 1 })
    const flipped = blob.ct[0] === "A" ? "B" : "A"
    await expect(openVault({ ...blob, ct: flipped + blob.ct.slice(1) }, "p")).rejects.toThrow()
  }, TIMEOUT)
})

describe("generatePassphrase", () => {
  it("produces distinct high-entropy phrases", () => {
    const phrases = new Set(Array.from({ length: 50 }, generatePassphrase))
    expect(phrases.size).toBe(50)
  })

  it("produces a typeable grouped phrase", () => {
    expect(generatePassphrase()).toMatch(/^[0-9a-z]{5}(-[0-9a-z]{5}){3}$/)
  })

  it("keeps the alphabet at exactly 32 unambiguous symbols", () => {
    const symbols = new Set(
      Array.from({ length: 200 }, generatePassphrase).join("").replace(/-/g, ""),
    )
    // 256 % 32 === 0, so `byte % 32` is uniform. A 33rd symbol would skew every
    // passphrase toward the early alphabet and silently cost entropy.
    expect(symbols.size).toBe(32)
    for (const ambiguous of ["i", "l", "o", "u"]) {
      expect(symbols.has(ambiguous)).toBe(false)
    }
  })
})
