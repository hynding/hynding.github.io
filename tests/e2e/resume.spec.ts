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
  await page.reload()
  await expect(page.getByText("steve.hynding@example.com")).toBeVisible()
})

test("applies the theme before first paint", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "slate")
  await expect(page.locator("html")).toHaveAttribute("data-template", "ats")
})
