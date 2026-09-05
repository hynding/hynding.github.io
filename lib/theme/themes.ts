export const TOKENS = [
  "bg",
  "surface",
  "text",
  "muted",
  "accent",
  "border",
  "rule",
] as const

export type Token = (typeof TOKENS)[number]

export interface Theme {
  id: string
  label: string
  /** Some palettes only make sense dark. A light Terminal is a lie. */
  darkOnly?: boolean
  light: Record<Token, string>
  dark: Record<Token, string>
}

const slate: Theme = {
  id: "slate",
  label: "Slate",
  light: {
    bg: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    accent: "#0369a1",
    border: "#e2e8f0",
    rule: "#cbd5e1",
  },
  dark: {
    bg: "#0b1120",
    surface: "#111827",
    text: "#e2e8f0",
    muted: "#94a3b8",
    accent: "#38bdf8",
    border: "#1e293b",
    rule: "#334155",
  },
}

export const themes: Theme[] = [slate]

export const DEFAULT_THEME = "slate"
export const DEFAULT_TEMPLATE = "ats"

const block = (selector: string, values: Record<Token, string>) =>
  `${selector}{${TOKENS.map((token) => `--${token}:${values[token]}`).join(";")}}`

/**
 * One definition, two consumers: these custom properties style the DOM, and
 * phase 4's scene reads the same `themes` objects for materials and lighting.
 */
export function themeCss(): string {
  const fallback = themes.find((theme) => theme.id === DEFAULT_THEME) ?? themes[0]

  return [
    // Element-selector defaults, specificity (0,0,1), so every [data-theme]
    // block outranks them regardless of source order. Without this, a page
    // whose pre-paint script never ran — JS disabled, CSP or an extension
    // blocking inline scripts, localStorage throwing on read — matches no
    // theme selector at all and renders every token undefined: an unstyled
    // wall of text, which is the exact failure the .nojekyll guard exists to
    // prevent, arriving by a different route.
    block("html", fallback.darkOnly ? fallback.dark : fallback.light),
    ...themes.flatMap((theme) => {
      const dark = block(`[data-theme="${theme.id}"][data-mode="dark"]`, theme.dark)
      if (theme.darkOnly) return [block(`[data-theme="${theme.id}"]`, theme.dark), dark]
      return [block(`[data-theme="${theme.id}"]`, theme.light), dark]
    }),
  ].join("\n")
}

/**
 * Runs before first paint. Reads both axes because template choice changes
 * layout structure, and a flash of the wrong layout cannot wait for React.
 */
export const PREPAINT_SCRIPT = `(function(){try{
var e=document.documentElement;
e.dataset.theme=localStorage.getItem("theme")||"${DEFAULT_THEME}";
e.dataset.template=localStorage.getItem("template")||"${DEFAULT_TEMPLATE}";
e.dataset.mode=localStorage.getItem("mode")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
}catch(_){}})();`
