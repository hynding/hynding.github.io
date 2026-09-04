import { test, expect } from "@playwright/test"

const FULL = "test-full-passphrase"

test("renders the resume with sensitive fields withheld", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Steve Hynding", level: 1 })).toBeVisible()
  await expect(page.getByText("Available on request").first()).toBeVisible()
  await expect(page.getByText("steve.hynding@example.com")).toHaveCount(0)
})

test("never ships plaintext secrets in the static output", async ({ request }) => {
  const html = await (await request.get("/")).text()
  expect(html).not.toContain("steve.hynding@example.com")
  expect(html).not.toContain("A Referee")
})

// The home page was never the plausible leak vector — the build only ever has
// ciphertext to put there. The vault blob is the file that would actually
// carry plaintext if `sealVault` were ever bypassed, so it needs its own
// assertion rather than being covered by a test whose name implies it.
test("serves ciphertext, not plaintext, in the vault blob", async ({ request }) => {
  const body = await (await request.get("/vault/full.json")).text()
  expect(body).not.toContain("steve.hynding@example.com")
  expect(body).not.toContain("A Referee")
  expect(body).not.toContain("555 0100")

  const blob = JSON.parse(body)
  expect(blob.v).toBe(1)
  expect(blob.audience).toBe("full")
  expect(typeof blob.ct).toBe("string")
  expect(typeof blob.iv).toBe("string")
  expect(blob.kdf).toMatchObject({ name: "PBKDF2", hash: "SHA-256", iterations: 600000 })
})

test("unlocks with the right passphrase and locks again", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Passphrase").fill(FULL)
  await page.getByRole("button", { name: "Unlock" }).click()

  await expect(page.getByText("steve.hynding@example.com")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("A Referee")).toBeVisible()

  await page.getByRole("button", { name: "Lock" }).click()
  await expect(page.getByText("steve.hynding@example.com")).toHaveCount(0)
})

test("rejects a wrong passphrase without revealing anything", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Passphrase").fill("not-the-passphrase")
  await page.getByRole("button", { name: "Unlock" }).click()

  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("steve.hynding@example.com")).toHaveCount(0)
})

test("a share link unlocks and strips the passphrase from the URL", async ({ page }) => {
  await page.goto(`/#k=full.${FULL}`)
  await expect(page.getByText("steve.hynding@example.com")).toBeVisible({ timeout: 30_000 })
  expect(page.url()).not.toContain("k=")
})

test("an unlocked session survives a reload", async ({ page }) => {
  await page.goto(`/#k=full.${FULL}`)
  await expect(page.getByText("steve.hynding@example.com")).toBeVisible({ timeout: 30_000 })
  // No explicit timeout: restoring from sessionStorage re-parses already
  // decrypted JSON and never re-runs the 600k-iteration derivation.
  await page.reload()
  await expect(page.getByText("steve.hynding@example.com")).toBeVisible()
})

// The reload test above passes under either storage backend, so on its own it
// pins nothing about privacy. sessionStorage is per tab; localStorage is
// shared by every tab in the same browser profile. A *new Playwright browser
// context* (`browser.newContext()`) is not the right probe for that — it is
// an isolated storage partition akin to a fresh incognito profile, so it
// wipes localStorage too and would pass under either backend. The actual
// discriminator is a second tab in the SAME context (`context.newPage()`):
// localStorage is visible there, sessionStorage is not. Verified directly:
// with sessionStorage swapped for localStorage in ResumeProvider.tsx, this
// test fails; with browser.newContext() it did not, so it does not appear
// here.
test("an unlocked session does not leak into a new tab in the same browser", async ({
  page,
  context,
}) => {
  await page.goto(`/#k=full.${FULL}`)
  await expect(page.getByText("steve.hynding@example.com")).toBeVisible({ timeout: 30_000 })

  const tab2 = await context.newPage()
  await tab2.goto("/")
  await expect(tab2.getByText("Available on request").first()).toBeVisible()
  await expect(tab2.getByText("steve.hynding@example.com")).toHaveCount(0)
  await tab2.close()
})

test("applies the theme before first paint", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "slate")
  await expect(page.locator("html")).toHaveAttribute("data-template", "ats")
})
