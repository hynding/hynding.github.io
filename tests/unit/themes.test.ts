import { describe, it, expect } from "vitest"
import { themes, TOKENS, themeCss, DEFAULT_THEME } from "@/lib/theme/themes"

describe("themes", () => {
  it("ships at least the default theme", () => {
    expect(themes.map((theme) => theme.id)).toContain(DEFAULT_THEME)
  })

  it("defines every token in every mode of every theme", () => {
    for (const theme of themes) {
      const modes = theme.darkOnly ? ["dark"] as const : ["light", "dark"] as const
      for (const mode of modes) {
        for (const token of TOKENS) {
          expect(theme[mode][token], `${theme.id}.${mode}.${token}`).toBeTruthy()
        }
      }
    }
  })

  it("uses unique theme ids", () => {
    const ids = themes.map((theme) => theme.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("themeCss", () => {
  it("emits a custom property per token", () => {
    const css = themeCss()
    for (const token of TOKENS) expect(css).toContain(`--${token}:`)
  })

  it("emits a selector per theme", () => {
    for (const theme of themes) expect(themeCss()).toContain(`[data-theme="${theme.id}"]`)
  })
})
