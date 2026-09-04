# Portfolio Site — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken placeholder at `hynding.github.io` with a real, deployed, ATS-parseable resume site built on a validated data model and a working encrypted-vault privacy layer.

**Architecture:** One Next.js app at the repository root. A single YAML document parses into a Zod-validated model that knows nothing about presentation; a document renderer consumes it through a pure `resolve()` redaction primitive. Sensitive values live in a gitignored private YAML, are encrypted per audience at build time into static blobs, and are decrypted in-browser with a passphrase.

**Tech Stack:** Next ^15.5.25 (`output: "export"`) · React 19.1 · TypeScript 5 · Tailwind v4 · Zod 3 · js-yaml · Vitest · Playwright · tsx · GitHub Actions → Pages

**Spec:** `docs/superpowers/specs/2026-09-03-portfolio-refactor-design.md`

## Global Constraints

- **Static export only.** `output: "export"` in `next.config.ts`. No route handlers, no middleware, no server runtime. Filesystem reads happen at build time only.
- **`images: { unoptimized: true }`** is required under static export.
- **The repository is public.** `data/resume.private.yaml` and `public/vault/` are gitignored and must never be committed.
- **Node 20 or later** (spike verified on 22.14.0).
- **Zod is pinned to `^3.23`.** Zod 4 changed API surface; all code in this plan is Zod 3.
- **Next is `^15.5.25` and Vitest is `^5.0.0`** (controller ruling R8). Both floors are security-driven: the versions originally planned carry unfixed criticals.
- **Every array entry in every YAML document carries a unique `id`.** Enforced by schema. This is what makes the private-patch merge order-independent.
- **Quote every date-like YAML scalar.** js-yaml coerces by shape: `2000` becomes a number, `2023-01-01` becomes a `Date`, `2023-01` stays a string. The first two both fail `z.string()`.
- **KDF parameters are fixed:** PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte salt, AES-256-GCM, 12-byte IV.
- **Test commands:** `npm test` (Vitest, unit) · `npm run test:e2e` (Playwright) · `npm run build` (production static export).

## File Structure

| File | Responsibility |
| --- | --- |
| `next.config.ts` | Static export configuration |
| `data/resume.yaml` | Single public source of truth; private slots hold markers |
| `data/audiences.yaml` | Audience → tier entitlements |
| `data/resume.private.yaml` | Real sensitive values (gitignored) |
| `lib/resume/schema.ts` | Zod schema and inferred types; the model definition |
| `lib/resume/load.ts` | Read and validate YAML from the app root |
| `lib/resume/resolve.ts` | Pure redaction primitive, renderer-agnostic |
| `lib/resume/merge.ts` | id-keyed deep merge of a private patch into the model |
| `lib/vault/crypto.ts` | seal/open, shared by Node and browser via WebCrypto |
| `lib/theme/themes.ts` | Theme tokens, single definition for DOM and (later) scene |
| `scripts/build-vault.ts` | Build-time vault emission; `--init` passphrase generation |
| `components/document/templates/ats.tsx` | Single-column, parseable resume layout |
| `components/document/sections/*.tsx` | One section per resume region |
| `components/privacy/PrivateValue.tsx` | DOM wrapper over `resolve()` |
| `components/privacy/UnlockControl.tsx` | Passphrase entry, decrypt, lock |
| `components/shell/ResumeProvider.tsx` | Holds the merged, validated model |
| `app/layout.tsx` | Fonts, pre-paint script, metadata |
| `app/page.tsx` | Composes provider + template |
| `.github/workflows/deploy.yml` | Test, build, deploy to Pages |

---

### Task 1: Collapse the repository to a single Next.js app at root

Removes three abandoned efforts and moves the Next app to the root so that `process.cwd()` is a stable, meaningful base for build-time file reads.

**Files:**
- Delete: `index.html`, `index.js`, `app.js`, `services.js`, `search-trees.js`, `google-example.html`, `packages/`
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `.gitignore`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `public/.nojekyll`

**Interfaces:**
- Consumes: nothing
- Produces: a buildable app at the repo root; `npm run build` emits `out/`

- [ ] **Step 1: Verify the files being deleted are what the spec says they are**

```bash
node --check services.js; node --check search-trees.js   # both MUST fail: invalid syntax
wc -c app.js                                              # MUST be 0
grep -c YOUR_API_KEY google-example.html                  # MUST be >= 1: it is Google's sample
```

Expected: the first two report syntax errors, `app.js` is empty, the grep matches. If any check disagrees, stop and report — the file is not what the spec assumed.

- [ ] **Step 2: Move the Next app to the root and delete the rest**

```bash
git rm -r --cached packages/nextjs/out >/dev/null 2>&1 || true
mv packages/nextjs/app packages/nextjs/next-env.d.ts .
mv packages/nextjs/postcss.config.mjs .
rm -rf packages index.html index.js app.js services.js search-trees.js google-example.html
mkdir -p data lib components scripts tests/unit tests/e2e tests/fixtures public
touch public/.nojekyll
```

- [ ] **Step 3: Write the root configuration files**

`package.json`:

```json
{
  "name": "hynding-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "prebuild": "tsx scripts/build-vault.ts",
    "build": "next build",
    "vault:init": "tsx scripts/build-vault.ts --init",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "next lint"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "next": "^15.5.25",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@tailwindcss/postcss": "^4",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "tsx": "^4.19.0",
    "typescript": "^5",
    "vitest": "^5.0.0"
  }
}
```

`next.config.ts`:

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
}

export default nextConfig
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`.gitignore`:

```
node_modules
.next
out
.env
.DS_Store
data/*.private.yaml
public/vault
test-results
playwright-report
```

- [ ] **Step 4: Reduce `app/page.tsx` and `app/layout.tsx` to a minimal shell**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Steve Hynding",
  description: "Full-stack Engineer / UX Specialist",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx`:

```tsx
export default function Page() {
  return <main>Foundation</main>
}
```

`app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 5: Install and build**

Run: `npm install && npm run build --ignore-scripts`
Expected: build succeeds, `out/index.html` exists, `out/.nojekyll` exists.

```bash
test -f out/index.html && test -f out/.nojekyll && echo OK
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: collapse repo to a single Next.js app at root

Removes three abandoned efforts: a root playground whose files do not parse,
a stale CRA Three.js demo, and a duplicated resume YAML. Moves the Next app
to the root so build-time file reads have a stable base."
```

---

### Task 2: Zod schema for the resume model

The schema is the contract every later task depends on. It fails the build on malformed data rather than rendering `undefined` to a reader.

**Files:**
- Create: `lib/resume/schema.ts`, `vitest.config.mts`
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `tierSchema`, `type AudienceTier = "contact" | "references" | "clients" | "full"`
  - `privateMarkerSchema`, `type PrivateMarker = { private: AudienceTier; public: string }`
  - `maybePrivate<T>(inner: T)` → `z.ZodUnion`
  - `resumeSchema`, `type Resume`
  - `workEntrySchema`, `educationEntrySchema`, `referenceEntrySchema`

- [ ] **Step 1: Add the Vitest config**

`vitest.config.mts`:

```typescript
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
})
```

- [ ] **Step 2: Write the failing test**

`tests/unit/schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { resumeSchema, privateMarkerSchema } from "@/lib/resume/schema"

const validResume = {
  basics: {
    name: "Steve Hynding",
    role: "Full-stack Engineer / UX Specialist",
    website: "https://hynding.github.io",
    summary: "Experienced full-stack engineer with a strong background in UX design.",
    email: { private: "contact", public: "Available on request" },
    phone: { private: "contact", public: "Available on request" },
    skills: ["TypeScript", "React"],
  },
  work: [
    {
      id: "bcg",
      company: "Boston Consulting Group",
      position: "Lead Engineer (Full-stack)",
      duration: "April 2016 - Present",
      responsibilities: ["Built things."],
      technologies: ["Node.js"],
    },
  ],
  education: [
    { id: "lmu", institution: "Loyola Marymount University", year: "2000", study: "B.A. Film Production" },
  ],
  certifications: ["Meta Front-end Development (In-progress)"],
  references: { private: "references", public: "Available on request" },
}

describe("resumeSchema", () => {
  it("accepts a valid document", () => {
    expect(resumeSchema.parse(validResume)).toBeTruthy()
  })

  it("accepts a real value where a private marker is allowed", () => {
    const unlocked = { ...validResume, basics: { ...validResume.basics, email: "a@b.com" } }
    expect(resumeSchema.parse(unlocked).basics.email).toBe("a@b.com")
  })

  it("rejects an array entry with no id", () => {
    const noId = { ...validResume, work: [{ ...validResume.work[0], id: undefined }] }
    expect(() => resumeSchema.parse(noId)).toThrow()
  })

  it("rejects a Date, which is what an unquoted YAML date becomes", () => {
    const dated = {
      ...validResume,
      education: [{ ...validResume.education[0], year: new Date("2000-01-01") }],
    }
    expect(() => resumeSchema.parse(dated)).toThrow()
  })

  it("rejects duplicate ids within an array", () => {
    const dupes = { ...validResume, work: [validResume.work[0], { ...validResume.work[0] }] }
    expect(() => resumeSchema.parse(dupes)).toThrow(/duplicate id/)
  })

  it("rejects duplicate ids in a gated collection once unlocked", () => {
    const reference = { id: "a", name: "A", title: "T", contact: "c" }
    const dupes = { ...validResume, references: [reference, { ...reference }] }
    expect(() => resumeSchema.parse(dupes)).toThrow(/duplicate id/)
  })

  it("rejects an unknown tier in a private marker", () => {
    expect(() => privateMarkerSchema.parse({ private: "salary", public: "x" })).toThrow()
  })

  it("rejects a private marker with no public placeholder", () => {
    expect(() => privateMarkerSchema.parse({ private: "contact" })).toThrow()
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm test -- tests/unit/schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/resume/schema`.

- [ ] **Step 4: Write the schema**

`lib/resume/schema.ts`:

```typescript
import { z } from "zod"

export const AUDIENCE_TIERS = ["contact", "references", "clients", "full"] as const

export const tierSchema = z.enum(AUDIENCE_TIERS)
export type AudienceTier = z.infer<typeof tierSchema>

/**
 * A declared-but-withheld value. The public document always states what the
 * value would be and who may see it, so the UI renders an affordance rather
 * than a hole.
 */
export const privateMarkerSchema = z
  .object({
    private: tierSchema,
    public: z.string().min(1),
  })
  .strict()

export type PrivateMarker = z.infer<typeof privateMarkerSchema>

/** A slot that may hold either a real value or a private marker. */
export const maybePrivate = <T extends z.ZodTypeAny>(inner: T) =>
  z.union([privateMarkerSchema, inner])

/**
 * Every array entry carries an id so that private patches merge by key rather
 * than by position. Positional merging silently misapplies values when the
 * public document is reordered.
 */
const entryId = z.string().min(1)

/**
 * Presence of an id is not enough. `merge()` locates entries with findIndex,
 * so a duplicate id makes the second entry unreachable and silently lands
 * every patch on the first — which is exactly the class of failure the id
 * rule exists to prevent.
 */
const uniqueById = <T extends z.ZodTypeAny>(entry: T) =>
  z.array(entry).superRefine((entries, ctx) => {
    const seen = new Set<string>()
    entries.forEach((item, index) => {
      const { id } = item as { id: string }
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `duplicate id "${id}"`,
        })
      }
      seen.add(id)
    })
  })

export const workEntrySchema = z.object({
  id: entryId,
  company: maybePrivate(z.string()),
  position: z.string(),
  duration: z.string(),
  responsibilities: z.array(z.string()),
  technologies: z.array(z.string()),
})

export const educationEntrySchema = z.object({
  id: entryId,
  institution: z.string(),
  year: z.string(),
  study: z.string(),
})

export const referenceEntrySchema = z.object({
  id: entryId,
  name: z.string(),
  title: z.string(),
  contact: z.string(),
})

export const resumeSchema = z.object({
  basics: z.object({
    name: z.string(),
    role: z.string(),
    website: z.string().url(),
    summary: z.string(),
    email: maybePrivate(z.string()),
    phone: maybePrivate(z.string()),
    skills: z.array(z.string()),
  }),
  work: uniqueById(workEntrySchema),
  education: uniqueById(educationEntrySchema),
  certifications: z.array(z.string()),
  references: maybePrivate(uniqueById(referenceEntrySchema)),
})

export type Resume = z.infer<typeof resumeSchema>
export type WorkEntry = z.infer<typeof workEntrySchema>
export type ReferenceEntry = z.infer<typeof referenceEntrySchema>
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test -- tests/unit/schema.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/resume/schema.ts tests/unit/schema.test.ts vitest.config.mts
git commit -m "feat: add Zod schema for the resume model

Declares sensitive slots rather than omitting them, requires an id on every
array entry so private patches merge by key, and rejects the Date objects
that unquoted YAML dates silently produce."
```

---

### Task 3: Consolidate the resume data and load it from the app root

Three drifting YAML copies become one. The loader resolves from `process.cwd()`, which is now meaningful because the app is the repository root — the old `"../resume/steve-hynding.yaml"` was relative to whatever directory the process happened to start in.

**Files:**
- Create: `data/resume.yaml`, `data/audiences.yaml`, `lib/resume/load.ts`
- Test: `tests/unit/load.test.ts`

**Interfaces:**
- Consumes: `resumeSchema`, `Resume` from Task 2
- Produces:
  - `readYaml(file: string): unknown`
  - `readYamlIfPresent(file: string): unknown | null`
  - `loadResume(): Resume`
  - `loadAudiences(): Record<string, AudienceTier[]>`

**Note on content:** `company` for Boston Consulting Group is kept **public**. It is the author's employer, not a client — the `clients` tier exists for the identities of BCG's clients, which arrive with the portfolio in phase 3. The vault mechanism is exercised here by `email`, `phone`, and `references`.

- [ ] **Step 1: Write `data/resume.yaml`**

```yaml
basics:
  name: Steve Hynding
  role: Full-stack Engineer / UX Specialist
  website: https://hynding.github.io
  summary: >-
    Experienced full-stack engineer with a strong background in UX design.
  email:
    private: contact
    public: Available on request
  phone:
    private: contact
    public: Available on request
  skills:
    - Node.js
    - React
    - TypeScript
    - HTML
    - CSS
    - AWS
    - Python
    - Vue
    - Angular
    - D3
    - Material UI
    - Tailwind
    - Cucumber
    - Selenium

work:
  - id: bcg
    company: Boston Consulting Group
    position: Lead Engineer (Full-stack)
    duration: April 2016 - Present
    responsibilities:
      - >-
        Worked with partners and clients to develop a wide variety of software
        solutions from innovation prototypes through to production.
      - >-
        Engineered and integrated full-stack solutions for content management
        systems, analytics charting, IoT and AI training interfaces.
      - >-
        Teamed with designers and product managers to build responsive,
        test-driven web applications.
    technologies:
      - Node.js
      - React
      - TypeScript
      - AWS
      - Python
      - D3

education:
  - id: lmu
    institution: Loyola Marymount University
    year: "2000"
    study: B.A. Film Production / Computer Science (minor)
  - id: smc
    institution: Santa Monica College
    year: "2005"
    study: Java Server Pages

certifications:
  - Meta Front-end Development (In-progress)
  - Google Cyber Security (In-progress)
  - Google Data Analytics (In-progress)

references:
  private: references
  public: Available on request
```

`data/audiences.yaml`:

```yaml
recruiter: [contact, clients]
full: [contact, clients, references, full]
```

- [ ] **Step 2: Write the failing test**

`tests/unit/load.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { loadResume, loadAudiences, readYamlIfPresent } from "@/lib/resume/load"

describe("loadResume", () => {
  it("parses and validates the real data file", () => {
    const resume = loadResume()
    expect(resume.basics.name).toBe("Steve Hynding")
    expect(resume.work.length).toBeGreaterThan(0)
  })

  it("gives every array entry a unique id", () => {
    const resume = loadResume()
    for (const list of [resume.work, resume.education]) {
      const ids = list.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("leaves education years as strings, not Dates", () => {
    for (const entry of loadResume().education) {
      expect(typeof entry.year).toBe("string")
    }
  })
})

describe("loadAudiences", () => {
  it("maps each audience to a list of tiers", () => {
    const audiences = loadAudiences()
    expect(audiences.recruiter).toContain("contact")
    expect(audiences.full).toContain("references")
  })
})

describe("readYamlIfPresent", () => {
  it("returns null for a file that does not exist", () => {
    expect(readYamlIfPresent("definitely-not-here.yaml")).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm test -- tests/unit/load.test.ts`
Expected: FAIL — cannot resolve `@/lib/resume/load`.

- [ ] **Step 4: Write the loader**

`lib/resume/load.ts`:

```typescript
import fs from "node:fs"
import path from "node:path"
import yaml from "js-yaml"
import { resumeSchema, tierSchema, type AudienceTier, type Resume } from "./schema"
import { z } from "zod"

/**
 * The app is the repository root, so cwd is a stable base. The previous
 * loader used a path relative to the process working directory and worked
 * only when `next dev` ran from inside packages/nextjs.
 */
const dataPath = (file: string) => path.join(process.cwd(), "data", file)

export function readYaml(file: string): unknown {
  return yaml.load(fs.readFileSync(dataPath(file), "utf8"))
}

export function readYamlIfPresent(file: string): unknown | null {
  const target = dataPath(file)
  return fs.existsSync(target) ? yaml.load(fs.readFileSync(target, "utf8")) : null
}

export function loadResume(): Resume {
  return resumeSchema.parse(readYaml("resume.yaml"))
}

const audiencesSchema = z.record(z.array(tierSchema))

export function loadAudiences(): Record<string, AudienceTier[]> {
  return audiencesSchema.parse(readYaml("audiences.yaml"))
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test -- tests/unit/load.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add data lib/resume/load.ts tests/unit/load.test.ts
git commit -m "feat: consolidate resume data into one validated source

Merges three drifting YAML copies into data/resume.yaml and resolves it from
the app root rather than the process working directory."
```

---

### Task 4: `resolve()` — the redaction primitive

A pure function, not a React component. The 3D scene in phase 4 renders text into WebGL where a `<span>` is meaningless, and the print route wants the value with no lock affordance at all — so the shared primitive must be renderer-agnostic.

**Files:**
- Create: `lib/resume/resolve.ts`
- Test: `tests/unit/resolve.test.ts`

**Interfaces:**
- Consumes: `PrivateMarker` from Task 2
- Produces:
  - `isPrivateMarker(value: unknown): value is PrivateMarker`
  - `type Resolved<T> = { value: T; locked: false } | { value: string; locked: true }`
  - `resolve<T>(field: T | PrivateMarker): Resolved<T>`

- [ ] **Step 1: Write the failing test**

`tests/unit/resolve.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/resolve.test.ts`
Expected: FAIL — cannot resolve `@/lib/resume/resolve`.

- [ ] **Step 3: Write the implementation**

`lib/resume/resolve.ts`:

```typescript
import type { PrivateMarker } from "./schema"

export function isPrivateMarker(value: unknown): value is PrivateMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "private" in value &&
    "public" in value &&
    typeof (value as { public: unknown }).public === "string"
  )
}

export type Resolved<T> =
  | { value: T; locked: false }
  | { value: string; locked: true }

/**
 * Renderer-agnostic by design. `<PrivateValue>` wraps this for the DOM, the
 * scene calls it for text meshes, and the print route calls it and renders
 * the value with no lock chrome.
 */
export function resolve<T>(field: T | PrivateMarker): Resolved<T> {
  if (isPrivateMarker(field)) return { value: field.public, locked: true }
  return { value: field as T, locked: false }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/resolve.test.ts`
Expected: PASS, 8 tests (3 in the `resolve` block, plus 5 rows from the
`it.each` in the `isPrivateMarker` block).

- [ ] **Step 5: Commit**

```bash
git add lib/resume/resolve.ts tests/unit/resolve.test.ts
git commit -m "feat: add renderer-agnostic redaction primitive"
```

---

### Task 5: `merge()` — id-keyed deep merge

The mechanism most likely to fail silently, so it is tested hardest. Positional array merging misapplies every private value the moment the public document is reordered, with no error anywhere.

**Files:**
- Create: `lib/resume/merge.ts`
- Test: `tests/unit/merge.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `merge(base: unknown, patch: unknown): unknown`

- [ ] **Step 1: Write the failing test**

`tests/unit/merge.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/merge.test.ts`
Expected: FAIL — cannot resolve `@/lib/resume/merge`.

- [ ] **Step 3: Write the implementation**

`lib/resume/merge.ts`:

```typescript
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const hasId = (value: unknown): value is { id: string } =>
  isPlainObject(value) && typeof value.id === "string"

/**
 * Deep-merges a private patch into the public model.
 *
 * Arrays merge by `id`, never by position: a patch must survive the public
 * document being reordered, and positional merging would silently apply a
 * value to the wrong entry. An id absent from the base is appended, which is
 * how wholly-confidential entries arrive.
 *
 * Neither input is ever mutated. The result is not a deep clone, though:
 * subtrees the patch does not touch are shared by reference with the base,
 * which is ordinary persistent-update behaviour. `merge(base, undefined)`
 * therefore returns the base itself. Callers must treat the result as
 * read-only — both call sites pass it straight to `resumeSchema.parse()`,
 * which does not mutate its input.
 */
export function merge(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base

  if (Array.isArray(patch)) {
    // Validate every entry before branching. Checking inside the merge loop
    // below would skip validation entirely on the replace path, so the same
    // id-less entry would throw or not depending on the base's shape.
    for (const entry of patch) {
      if (!hasId(entry)) {
        throw new Error(`merge: every array entry needs an id, received ${JSON.stringify(entry)}`)
      }
    }

    if (!Array.isArray(base)) return patch
    const out = [...base]
    for (const entry of patch) {
      const index = out.findIndex((existing) => hasId(existing) && existing.id === entry.id)
      if (index === -1) out.push(entry)
      else out[index] = merge(out[index], entry)
    }
    return out
  }

  if (isPlainObject(patch) && isPlainObject(base)) {
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) {
      out[key] = merge(base[key], value)
    }
    return out
  }

  return patch
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/merge.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/resume/merge.ts tests/unit/merge.test.ts
git commit -m "feat: add id-keyed deep merge for private patches

Merging by position would silently misapply every private value when the
public document is reordered. Keying by id makes the patch order-independent
and lets confidential entries append."
```

---

### Task 6: Vault crypto

One module, used by both the Node build script and the browser. WebCrypto is available in both (Node 20+ exposes `globalThis.crypto.subtle`), so there is no need for two implementations that could drift apart on parameters.

**Files:**
- Create: `lib/vault/crypto.ts`
- Test: `tests/unit/crypto.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `KDF_ITERATIONS = 600_000`
  - `interface VaultBlob { v: 1; audience: string; kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string }; iv: string; ct: string }`
  - `sealVault(audience: string, passphrase: string, payload: unknown): Promise<VaultBlob>`
  - `openVault(blob: VaultBlob, passphrase: string): Promise<unknown>`
  - `generatePassphrase(): string`

- [ ] **Step 1: Write the failing test**

`tests/unit/crypto.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/crypto.test.ts`
Expected: FAIL — cannot resolve `@/lib/vault/crypto`.

- [ ] **Step 3: Write the implementation**

`lib/vault/crypto.ts`:

```typescript
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** OWASP's current floor for PBKDF2-HMAC-SHA256. */
export const KDF_ITERATIONS = 600_000

export interface VaultBlob {
  v: 1
  audience: string
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string }
  iv: string
  ct: string
}

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function sealVault(
  audience: string,
  passphrase: string,
  payload: unknown,
): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  )
  return {
    v: 1,
    audience,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt: toBase64(salt) },
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  }
}

/**
 * Throws on a wrong passphrase or tampered ciphertext — AES-GCM authenticates,
 * so failure is clean rather than plausible garbage.
 */
export async function openVault(blob: VaultBlob, passphrase: string): Promise<unknown> {
  const key = await deriveKey(passphrase, fromBase64(blob.kdf.salt), blob.kdf.iterations)
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ct),
  )
  return JSON.parse(decoder.decode(plaintext))
}

/**
 * Crockford base32 without the ambiguous letters, in four groups of five:
 * 20 symbols x 5 bits = 100 bits of entropy, drawn from the CSPRNG.
 *
 * Deviation from the spec, which named six EFF-wordlist words (~77 bits).
 * Vendoring a 7,776-word list to gain memorability is not worth it when the
 * passphrase travels by link rather than by memory, and this is stronger.
 */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

export function generatePassphrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const symbols = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length])
  return [0, 5, 10, 15].map((start) => symbols.slice(start, start + 5).join("")).join("-")
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/crypto.test.ts`
Expected: PASS, 7 tests. Expect this file to take several seconds — the KDF is deliberately slow.

- [ ] **Step 5: Commit**

```bash
git add lib/vault/crypto.ts tests/unit/crypto.test.ts
git commit -m "feat: add vault crypto shared by build and browser

AES-256-GCM under a PBKDF2-HMAC-SHA256 key at 600k iterations. One module for
both runtimes so the parameters cannot drift apart."
```

---

### Task 7: Vault path utilities

Finding markers and reading/writing values at a path needs id-awareness, exactly like `merge()`. Kept separate from the build script so it is testable without touching the filesystem.

**Files:**
- Create: `lib/vault/paths.ts`
- Test: `tests/unit/vault-paths.test.ts`

**Interfaces:**
- Consumes: `isPrivateMarker` (Task 4), `AudienceTier` (Task 2)
- Produces:
  - `type Segment = string | { id: string }`
  - `findMarkers(node: unknown): Array<{ path: Segment[]; tier: AudienceTier }>`
  - `getAtPath(root: unknown, path: Segment[]): unknown`
  - `setAtPath(root: Record<string, unknown>, path: Segment[], value: unknown): void`

- [ ] **Step 1: Write the failing test**

`tests/unit/vault-paths.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/vault-paths.test.ts`
Expected: FAIL — cannot resolve `@/lib/vault/paths`.

- [ ] **Step 3: Write the implementation**

`lib/vault/paths.ts`:

```typescript
import { isPrivateMarker } from "../resume/resolve"
import type { AudienceTier } from "../resume/schema"

/** A path step: an object key, or an array entry addressed by id. */
export type Segment = string | { id: string }

export interface FoundMarker {
  path: Segment[]
  tier: AudienceTier
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export function findMarkers(node: unknown, trail: Segment[] = []): FoundMarker[] {
  if (isPrivateMarker(node)) return [{ path: trail, tier: node.private }]

  if (Array.isArray(node)) {
    return node.flatMap((entry) => {
      const id = isPlainObject(entry) && typeof entry.id === "string" ? entry.id : null
      return id === null ? [] : findMarkers(entry, [...trail, { id }])
    })
  }

  if (isPlainObject(node)) {
    return Object.entries(node).flatMap(([key, value]) => findMarkers(value, [...trail, key]))
  }

  return []
}

export function getAtPath(root: unknown, path: Segment[]): unknown {
  let current: unknown = root
  for (const segment of path) {
    if (current === null || current === undefined) return undefined
    if (typeof segment === "string") {
      if (!isPlainObject(current)) return undefined
      current = current[segment]
    } else {
      if (!Array.isArray(current)) return undefined
      current = current.find((entry) => isPlainObject(entry) && entry.id === segment.id)
    }
  }
  return current
}

export function setAtPath(
  root: Record<string, unknown>,
  path: Segment[],
  value: unknown,
): void {
  // A path must begin and end with an object key. The walk below consumes id
  // segments as lookaheads from a preceding string key, so an id in either
  // terminal position is not merely unsupported — it silently writes nothing,
  // or writes to the root instead of into the array entry. Fail loudly.
  if (path.length === 0) {
    throw new Error("setAtPath: path must not be empty")
  }
  const first = path[0]
  const final = path[path.length - 1]
  if (typeof first !== "string") {
    throw new Error(`setAtPath: path must start with an object key, received ${JSON.stringify(first)}`)
  }
  if (typeof final !== "string") {
    throw new Error(`setAtPath: path must end with an object key, received ${JSON.stringify(final)}`)
  }

  let container: Record<string, unknown> = root

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    const next = path[index + 1]

    if (typeof segment === "string") {
      if (container[segment] === undefined) {
        container[segment] = typeof next === "string" ? {} : []
      }
      const child = container[segment]
      if (Array.isArray(child)) {
        // The next segment is an id lookup; resolve it on this array.
        const id = (next as { id: string }).id
        let entry = child.find((item) => isPlainObject(item) && item.id === id) as
          | Record<string, unknown>
          | undefined
        if (!entry) {
          entry = { id }
          child.push(entry)
        }
        container = entry
        index += 1 // consumed the id segment
      } else {
        container = child as Record<string, unknown>
      }
    }
  }

  const last = path[path.length - 1]
  if (typeof last === "string") container[last] = value
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/vault-paths.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/vault/paths.ts tests/unit/vault-paths.test.ts
git commit -m "feat: add id-aware path utilities for vault assembly"
```

---

### Task 8: Build the vault

The two behaviours that matter most are the ones a happy-path implementation gets wrong: the build must **succeed with no private files at all** (the state of every fork and fresh clone), and it must validate the **merged document** rather than the partial patch, which cannot satisfy a schema full of required fields.

**Files:**
- Create: `lib/vault/build.ts`, `scripts/build-vault.ts`
- Test: `tests/unit/vault-build.test.ts`

**Interfaces:**
- Consumes: `findMarkers`, `getAtPath`, `setAtPath` (Task 7); `merge` (Task 5); `sealVault`, `generatePassphrase`, `VaultBlob` (Task 6); `resumeSchema` (Task 2)
- Produces: `buildVaults(input: BuildVaultsInput): Promise<Record<string, VaultBlob>>`

- [ ] **Step 1: Write the failing test**

`tests/unit/vault-build.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/vault-build.test.ts`
Expected: FAIL — cannot resolve `@/lib/vault/build`.

- [ ] **Step 3: Write the builder**

`lib/vault/build.ts`:

```typescript
import { resumeSchema, type AudienceTier } from "../resume/schema"
import { merge } from "../resume/merge"
import { findMarkers, getAtPath, setAtPath } from "./paths"
import { sealVault, type VaultBlob } from "./crypto"

export interface BuildVaultsInput {
  resume: unknown
  /** The private patch, or null when no private files are present. */
  patch: unknown
  audiences: Readonly<Record<string, readonly AudienceTier[]>>
  passphraseFor: (audience: string) => string | undefined
}

const describePath = (path: (string | { id: string })[]) =>
  path.map((segment) => (typeof segment === "string" ? segment : `#${segment.id}`)).join(".")

export async function buildVaults({
  resume,
  patch,
  audiences,
  passphraseFor,
}: BuildVaultsInput): Promise<Record<string, VaultBlob>> {
  // No private data is the normal state for a fork or a fresh clone. The site
  // builds, and every gated field renders its public placeholder.
  if (patch === null || patch === undefined) return {}

  const markers = findMarkers(resume)

  const missing = markers.filter((marker) => getAtPath(patch, marker.path) === undefined)
  if (missing.length > 0) {
    throw new Error(
      `vault: no private value for ${missing.map((m) => describePath(m.path)).join(", ")}`,
    )
  }

  const blobs: Record<string, VaultBlob> = {}

  for (const [audience, tiers] of Object.entries(audiences)) {
    const entitled = markers.filter((marker) => tiers.includes(marker.tier))
    if (entitled.length === 0) continue

    const audiencePatch: Record<string, unknown> = {}
    for (const marker of entitled) {
      setAtPath(audiencePatch, marker.path, getAtPath(patch, marker.path))
    }

    // Validate the MERGED document. The patch is partial and would fail every
    // required field; validating the merge needs no second schema and also
    // catches a private value landing where it does not typecheck.
    resumeSchema.parse(merge(resume, audiencePatch))

    const passphrase = passphraseFor(audience)
    if (!passphrase) {
      throw new Error(`vault: missing passphrase for audience "${audience}"`)
    }

    blobs[audience] = await sealVault(audience, passphrase, audiencePatch)
  }

  return blobs
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/vault-build.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the CLI shell**

`scripts/build-vault.ts`:

```typescript
import fs from "node:fs"
import path from "node:path"
import { loadAudiences, readYaml, readYamlIfPresent } from "../lib/resume/load"
import { resumeSchema } from "../lib/resume/schema"
import { buildVaults } from "../lib/vault/build"
import { generatePassphrase } from "../lib/vault/crypto"

const VAULT_DIR = path.join(process.cwd(), "public", "vault")

async function main() {
  if (process.argv.includes("--init")) {
    const audience = process.argv[process.argv.indexOf("--init") + 1] ?? "recruiter"
    console.log(`\n  audience:   ${audience}`)
    console.log(`  passphrase: ${generatePassphrase()}\n`)
    console.log(`  Store it, then set VAULT_PASSPHRASE_${audience.toUpperCase()} to it.`)
    console.log(`  It is not written to disk and cannot be recovered.\n`)
    return
  }

  const resume = readYaml("resume.yaml")
  resumeSchema.parse(resume)

  fs.rmSync(VAULT_DIR, { recursive: true, force: true })

  const patch = readYamlIfPresent("resume.private.yaml")
  if (patch === null) {
    console.warn("[vault] no data/resume.private.yaml — building in public mode")
    return
  }

  const blobs = await buildVaults({
    resume,
    patch,
    audiences: loadAudiences(),
    passphraseFor: (audience) => process.env[`VAULT_PASSPHRASE_${audience.toUpperCase()}`],
  })

  fs.mkdirSync(VAULT_DIR, { recursive: true })
  for (const [audience, blob] of Object.entries(blobs)) {
    fs.writeFileSync(path.join(VAULT_DIR, `${audience}.json`), JSON.stringify(blob))
    console.log(`[vault] sealed ${audience}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
```

- [ ] **Step 6: Verify the public-mode build end to end**

Run: `npm run build`
Expected: logs `[vault] no data/resume.private.yaml — building in public mode`, build succeeds, `public/vault/` is absent.

- [ ] **Step 7: Commit**

```bash
git add lib/vault/build.ts scripts/build-vault.ts tests/unit/vault-build.test.ts
git commit -m "feat: emit per-audience encrypted vaults at build time

Builds in public mode when no private files exist, so a fork or fresh clone
still produces a complete site. Validates the merged document rather than the
partial patch, which no complete schema can accept."
```

---

### Task 9: Theme tokens and the pre-paint script

Tokens are defined once and emitted as CSS custom properties, so phase 4's scene can read the same object for materials without a second palette drifting out of sync. The pre-paint script handles both theme *and* template because template choice is structural — a flash of the wrong layout is far worse than a flash of the wrong colour, and neither can wait for hydration.

**Files:**
- Create: `lib/theme/themes.ts`
- Modify: `app/globals.css`, `app/layout.tsx`
- Test: `tests/unit/themes.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TOKENS: readonly Token[]`, `type Token`
  - `interface Theme { id: string; label: string; darkOnly?: boolean; light: Record<Token, string>; dark: Record<Token, string> }`
  - `themes: Theme[]`, `DEFAULT_THEME = "slate"`, `DEFAULT_TEMPLATE = "ats"`
  - `themeCss(): string`
  - `PREPAINT_SCRIPT: string`

- [ ] **Step 1: Write the failing test**

`tests/unit/themes.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/themes.test.ts`
Expected: FAIL — cannot resolve `@/lib/theme/themes`.

- [ ] **Step 3: Write the theme module**

`lib/theme/themes.ts`:

```typescript
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
  return themes
    .flatMap((theme) => {
      const dark = block(`[data-theme="${theme.id}"][data-mode="dark"]`, theme.dark)
      if (theme.darkOnly) return [block(`[data-theme="${theme.id}"]`, theme.dark), dark]
      return [block(`[data-theme="${theme.id}"]`, theme.light), dark]
    })
    .join("\n")
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
```

- [ ] **Step 4: Wire the tokens into the layout and stylesheet**

`app/globals.css`:

```css
@import "tailwindcss";

html,
body {
  background: var(--bg);
  color: var(--text);
}

body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.55;
}
```

`app/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { PREPAINT_SCRIPT, themeCss } from "@/lib/theme/themes"
import "./globals.css"

export const metadata: Metadata = {
  title: "Steve Hynding — Full-stack Engineer",
  description: "Resume and portfolio of Steve Hynding, full-stack engineer and UX specialist.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test -- tests/unit/themes.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/theme/themes.ts app/globals.css app/layout.tsx tests/unit/themes.test.ts
git commit -m "feat: define theme tokens once and apply them before first paint

Tokens emit as CSS custom properties for the DOM and stay available as plain
objects for the scene. The pre-paint script sets theme and template together,
because a flash of the wrong layout is worse than a flash of the wrong colour."
```

---

### Task 10: The ATS template

Single column, real heading elements, no meaning carried by icons, no text baked into images. This is the layout an applicant tracking system parses, so structure matters more than styling.

**Files:**
- Create: `components/privacy/PrivateValue.tsx`, `components/document/sections/*.tsx`, `components/document/templates/ats.tsx`
- Test: `tests/unit/private-value.test.tsx`
- Modify: `vitest.config.mts`, `app/page.tsx`

**Interfaces:**
- Consumes: `Resume`, `PrivateMarker` (Task 2); `resolve` (Task 4); `loadResume` (Task 3)
- Produces:
  - `<PrivateValue field={string | PrivateMarker} />`
  - `<AtsTemplate resume={Resume} />`

- [ ] **Step 1: Add a jsdom project to the Vitest config**

Install: `npm i -D jsdom @testing-library/react @vitejs/plugin-react`

`vitest.config.mts`:

```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
})
```

The DOM environment is selected per file by a docblock rather than by
`environmentMatchGlobs`, which modern Vitest removed in favour of the
`projects` API. A per-file docblock is stable across every Vitest major and
needs no project configuration at all.

- [ ] **Step 2: Write the failing test**

`tests/unit/private-value.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { PrivateValue } from "@/components/privacy/PrivateValue"

afterEach(cleanup)

describe("PrivateValue", () => {
  it("renders a real value with no lock state", () => {
    render(<PrivateValue field="steve@example.com" />)
    const node = screen.getByText("steve@example.com")
    expect(node.dataset.locked).toBe("false")
  })

  it("renders the placeholder and marks it locked", () => {
    render(<PrivateValue field={{ private: "contact", public: "Available on request" }} />)
    const node = screen.getByText("Available on request")
    expect(node.dataset.locked).toBe("true")
  })

  it("labels the locked state for assistive technology", () => {
    render(<PrivateValue field={{ private: "contact", public: "Available on request" }} />)
    expect(screen.getByLabelText(/withheld/i)).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm test -- tests/unit/private-value.test.tsx`
Expected: FAIL — cannot resolve `@/components/privacy/PrivateValue`.

- [ ] **Step 4: Write `PrivateValue`**

`components/privacy/PrivateValue.tsx`:

```tsx
import { resolve } from "@/lib/resume/resolve"
import type { PrivateMarker } from "@/lib/resume/schema"

/**
 * A thin DOM wrapper over `resolve()`. The primitive itself is a pure
 * function so the scene and the print route can share it — a span would be
 * meaningless inside a WebGL canvas.
 */
export function PrivateValue({ field }: { field: string | PrivateMarker }) {
  const { value, locked } = resolve(field)

  if (!locked) return <span data-locked="false">{value}</span>

  return (
    <span
      data-locked="true"
      aria-label={`${value} — withheld until unlocked`}
      className="italic text-[var(--muted)] underline decoration-dotted underline-offset-4"
    >
      {value}
    </span>
  )
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test -- tests/unit/private-value.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the sections**

`components/document/sections/Header.tsx`:

```tsx
import type { Resume } from "@/lib/resume/schema"
import { PrivateValue } from "@/components/privacy/PrivateValue"

export function Header({ basics }: { basics: Resume["basics"] }) {
  return (
    <header className="border-b border-[var(--rule)] pb-4">
      <h1 className="text-3xl font-semibold tracking-tight">{basics.name}</h1>
      <p className="text-[var(--muted)]">{basics.role}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li><PrivateValue field={basics.email} /></li>
        <li><PrivateValue field={basics.phone} /></li>
        <li><a href={basics.website} className="text-[var(--accent)]">{basics.website}</a></li>
      </ul>
    </header>
  )
}
```

`components/document/sections/Section.tsx`:

```tsx
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}
```

`components/document/sections/Work.tsx`:

```tsx
import type { Resume } from "@/lib/resume/schema"
import { PrivateValue } from "@/components/privacy/PrivateValue"

export function Work({ work }: { work: Resume["work"] }) {
  return (
    <div className="space-y-5">
      {work.map((entry) => (
        <article key={entry.id}>
          <h3 className="font-medium">
            {entry.position}, <PrivateValue field={entry.company} />
          </h3>
          <p className="text-sm text-[var(--muted)]">{entry.duration}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {entry.responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-[var(--muted)]">{entry.technologies.join(" · ")}</p>
        </article>
      ))}
    </div>
  )
}
```

`components/document/sections/References.tsx`:

```tsx
import { resolve } from "@/lib/resume/resolve"
import type { Resume } from "@/lib/resume/schema"

/**
 * A gated collection, not a gated scalar: locked it is a placeholder string,
 * unlocked it is an array. The two states do not share a render path, which
 * is why this branches rather than using PrivateValue.
 */
export function References({ references }: { references: Resume["references"] }) {
  const { value, locked } = resolve(references)

  if (locked) {
    return <p className="italic text-[var(--muted)]">{value}</p>
  }

  return (
    <ul className="space-y-2">
      {value.map((reference) => (
        <li key={reference.id}>
          <span className="font-medium">{reference.name}</span>
          <span className="text-[var(--muted)]"> — {reference.title}</span>
          <div className="text-sm text-[var(--muted)]">{reference.contact}</div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 7: Write the template and render it**

`components/document/templates/ats.tsx`:

```tsx
import type { Resume } from "@/lib/resume/schema"
import { Header } from "@/components/document/sections/Header"
import { Section } from "@/components/document/sections/Section"
import { Work } from "@/components/document/sections/Work"
import { References } from "@/components/document/sections/References"

/**
 * Single column, real headings, no meaning carried by icons, no text baked
 * into images — an applicant tracking system reads this before a human does.
 */
export function AtsTemplate({ resume }: { resume: Resume }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <Header basics={resume.basics} />

      <Section title="Summary">
        <p>{resume.basics.summary}</p>
      </Section>

      <Section title="Skills">
        <p>{resume.basics.skills.join(" · ")}</p>
      </Section>

      <Section title="Experience">
        <Work work={resume.work} />
      </Section>

      <Section title="Education">
        <ul className="space-y-1">
          {resume.education.map((entry) => (
            <li key={entry.id}>
              <span className="font-medium">{entry.institution}</span>
              <span className="text-[var(--muted)]"> — {entry.study}, {entry.year}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Certifications">
        <ul className="list-disc space-y-1 pl-5">
          {resume.certifications.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title="References">
        <References references={resume.references} />
      </Section>
    </article>
  )
}
```

`app/page.tsx`:

```tsx
import { loadResume } from "@/lib/resume/load"
import { AtsTemplate } from "@/components/document/templates/ats"

export default function Page() {
  return (
    <main>
      <AtsTemplate resume={loadResume()} />
    </main>
  )
}
```

- [ ] **Step 8: Verify the build renders real content**

Run: `npm run build && grep -c "Steve Hynding" out/index.html`
Expected: build succeeds, grep reports at least 1.

- [ ] **Step 9: Commit**

```bash
git add components app/page.tsx vitest.config.mts tests/unit/private-value.test.tsx package.json
git commit -m "feat: render the resume through the ATS template

Gated scalars go through PrivateValue; the gated references collection
branches on locked state, because a placeholder string and an array of
objects do not share a render path."
```

---

### Task 11: The unlock flow

The build is the only trusted execution context in a static site, so the decrypted blob is untrusted input even though the author wrote it. It is merged and then validated; on failure the app stays locked rather than rendering a broken page to the one person it was unlocked for.

**Files:**
- Create: `components/shell/ResumeProvider.tsx`, `components/privacy/UnlockControl.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Resume`, `resumeSchema` (Task 2); `merge` (Task 5); `openVault`, `VaultBlob` (Task 6); `loadAudiences` (Task 3)
- Produces:
  - `<ResumeProvider resume={Resume} audiences={string[]}>`
  - `useResume(): { resume: Resume; unlocked: boolean; unlock(passphrase: string, audience?: string): Promise<void>; lock(): void }`
  - `<UnlockControl />`

- [ ] **Step 1: Write the provider**

`components/shell/ResumeProvider.tsx`:

```tsx
"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { resumeSchema, type Resume } from "@/lib/resume/schema"
import { merge } from "@/lib/resume/merge"
import { openVault, type VaultBlob } from "@/lib/vault/crypto"

const STORAGE_KEY = "vault-patch"

interface ResumeContextValue {
  resume: Resume
  unlocked: boolean
  unlock: (passphrase: string, audience?: string) => Promise<void>
  lock: () => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

export function useResume(): ResumeContextValue {
  const context = useContext(ResumeContext)
  if (!context) throw new Error("useResume must be used inside ResumeProvider")
  return context
}

async function fetchAndOpen(audience: string, passphrase: string): Promise<unknown> {
  const response = await fetch(`/vault/${audience}.json`)
  if (!response.ok) throw new Error("no vault published for this audience")
  return openVault((await response.json()) as VaultBlob, passphrase)
}

export function ResumeProvider({
  resume,
  audiences,
  children,
}: {
  resume: Resume
  audiences: string[]
  children: React.ReactNode
}) {
  const [patch, setPatch] = useState<unknown>(null)

  /** Merge then validate: a partial patch cannot be validated on its own. */
  const applyPatch = useCallback(
    (candidate: unknown): Resume => resumeSchema.parse(merge(resume, candidate)),
    [resume],
  )

  const unlock = useCallback(
    async (passphrase: string, audience?: string) => {
      const candidates = audience ? [audience] : audiences
      let opened: unknown = null

      for (const name of candidates) {
        try {
          opened = await fetchAndOpen(name, passphrase)
          break
        } catch {
          // Wrong passphrase or no such blob; indistinguishable on purpose.
        }
      }

      if (opened === null) throw new Error("That passphrase did not work.")

      applyPatch(opened) // throws before anything is stored if the merge is invalid
      setPatch(opened)
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(opened))
      } catch {
        // Private browsing or blocked storage: unlocked for this render only.
      }
    },
    [applyPatch, audiences],
  )

  const lock = useCallback(() => {
    setPatch(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear.
    }
  }, [])

  // Restore a session, or consume a #k=<audience>.<passphrase> share link.
  useEffect(() => {
    const fragment = window.location.hash
    const match = /^#k=([^.]+)\.(.+)$/.exec(fragment)

    if (match) {
      // Strip before awaiting so the passphrase never lingers in the address
      // bar or in history, even if decryption is slow or fails.
      history.replaceState(null, "", window.location.pathname + window.location.search)
      void unlock(decodeURIComponent(match[2]), decodeURIComponent(match[1])).catch(() => {})
      return
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed: unknown = JSON.parse(stored)
      applyPatch(parsed)
      setPatch(parsed)
    } catch {
      // Stale or corrupt session data: stay locked.
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // Nothing to clear.
      }
    }
  }, [applyPatch, unlock])

  const value = useMemo<ResumeContextValue>(() => {
    let merged = resume
    if (patch !== null) {
      try {
        merged = applyPatch(patch)
      } catch {
        merged = resume
      }
    }
    return { resume: merged, unlocked: patch !== null, unlock, lock }
  }, [applyPatch, lock, patch, resume, unlock])

  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>
}
```

- [ ] **Step 2: Write the unlock control**

`components/privacy/UnlockControl.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useResume } from "@/components/shell/ResumeProvider"

export function UnlockControl() {
  const { unlocked, unlock, lock } = useResume()
  const [passphrase, setPassphrase] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (unlocked) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span role="status">Private details unlocked.</span>
        <button type="button" onClick={lock} className="underline underline-offset-4">
          Lock
        </button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError(null)
        try {
          await unlock(passphrase.trim())
          setPassphrase("")
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Unlock failed.")
        } finally {
          setPending(false)
        }
      }}
    >
      <label htmlFor="passphrase">Passphrase</label>
      <input
        id="passphrase"
        name="passphrase"
        type="password"
        autoComplete="off"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
      />
      <button
        type="submit"
        disabled={pending || passphrase.trim() === ""}
        className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-50"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
      {error ? (
        <span role="alert" className="text-[var(--muted)]">
          {error}
        </span>
      ) : null}
    </form>
  )
}
```

- [ ] **Step 3: Compose them on the page**

`app/page.tsx`:

```tsx
import { loadAudiences, loadResume } from "@/lib/resume/load"
import { ResumeProvider } from "@/components/shell/ResumeProvider"
import { UnlockControl } from "@/components/privacy/UnlockControl"
import { DocumentView } from "@/components/document/DocumentView"

export default function Page() {
  return (
    <ResumeProvider resume={loadResume()} audiences={Object.keys(loadAudiences())}>
      <header className="mx-auto flex max-w-3xl justify-end px-6 pt-6">
        <UnlockControl />
      </header>
      <main>
        <DocumentView />
      </main>
    </ResumeProvider>
  )
}
```

`components/document/DocumentView.tsx`:

```tsx
"use client"

import { useResume } from "@/components/shell/ResumeProvider"
import { AtsTemplate } from "@/components/document/templates/ats"

export function DocumentView() {
  const { resume } = useResume()
  return <AtsTemplate resume={resume} />
}
```

- [ ] **Step 4: Verify the build still succeeds**

Run: `npm run build`
Expected: build succeeds; `out/index.html` contains "Available on request" (locked placeholders are what the static HTML ships).

- [ ] **Step 5: Commit**

```bash
git add components app/page.tsx
git commit -m "feat: add in-browser unlock for the encrypted vault

Merges then validates, because a partial patch cannot be validated alone. A
share link's passphrase is stripped from the URL before decryption is even
attempted, and the decrypted patch lives in sessionStorage so a shared machine
retains nothing."
```

---

### Task 12: End-to-end tests

These exercise the built static output, not a dev server, because static export is what actually ships. Tests build their own vault from fixtures — the real passphrase never touches a test.

**Files:**
- Create: `playwright.config.ts`, `tests/fixtures/resume.private.yaml`, `tests/e2e/resume.spec.ts`
- Modify: `lib/resume/load.ts`, `scripts/build-vault.ts`, `package.json`
- Test: `tests/unit/load.test.ts` (extend)

**Interfaces:**
- Consumes: everything above
- Produces: `npm run test:e2e`

- [ ] **Step 1: Let the private file path be overridden, and test it**

Add to `tests/unit/load.test.ts`:

```typescript
import path from "node:path"

describe("readYamlIfPresent", () => {
  it("accepts an absolute path so tests can point at fixtures", () => {
    const fixture = path.join(process.cwd(), "tests/fixtures/resume.private.yaml")
    expect(readYamlIfPresent(fixture)).not.toBeNull()
  })
})
```

Modify `lib/resume/load.ts`:

```typescript
const dataPath = (file: string) =>
  path.isAbsolute(file) ? file : path.join(process.cwd(), "data", file)
```

Modify `scripts/build-vault.ts`, replacing the patch-reading line:

```typescript
  const patch = readYamlIfPresent(process.env.VAULT_PRIVATE_FILE ?? "resume.private.yaml")
```

- [ ] **Step 2: Write the fixture**

`tests/fixtures/resume.private.yaml`:

```yaml
basics:
  email: steve.hynding@example.com
  phone: "+1 555 0100"
references:
  - id: a-referee
    name: A Referee
    title: Managing Director
    contact: referee@example.com
```

- [ ] **Step 3: Add Playwright config and scripts**

Install: `npm i -D serve && npx playwright install --with-deps chromium`

`playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3210", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx serve out -l 3210 --no-clipboard",
    url: "http://localhost:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

Add to `package.json` scripts:

```json
    "build:e2e": "VAULT_PRIVATE_FILE=tests/fixtures/resume.private.yaml VAULT_PASSPHRASE_RECRUITER=test-recruiter-passphrase VAULT_PASSPHRASE_FULL=test-full-passphrase npm run build",
    "test:e2e": "npm run build:e2e && playwright test"
```

Note `VAULT_PRIVATE_FILE` here is relative to `data/`, so use the absolute form in CI if the path resolves oddly: `VAULT_PRIVATE_FILE=$PWD/tests/fixtures/resume.private.yaml`.

- [ ] **Step 4: Write the end-to-end tests**

`tests/e2e/resume.spec.ts`:

```typescript
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
```

- [ ] **Step 5: Run the end-to-end suite**

Run: `npm run test:e2e`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests package.json lib/resume/load.ts scripts/build-vault.ts
git commit -m "test: cover the unlock flow end to end against the static build

Includes the assertion that matters most: plaintext secrets never appear in
the exported HTML. Tests seal their own vault from fixtures."
```

---

### Task 13: Deploy to GitHub Pages

Two failure modes get explicit guards: Jekyll silently discarding `_next/`, and `metadataBase` defaulting to `localhost:3000` — which produces a site that looks perfect and whose every link preview is broken.

**Files:**
- Create: `.github/workflows/deploy.yml`, `public/og.png`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: everything above
- Produces: a deployed site at `https://hynding.github.io`

- [ ] **Step 1: Set `metadataBase` and share metadata**

Modify `app/layout.tsx`, replacing the `metadata` export:

```tsx
const SITE = "https://hynding.github.io"

export const metadata: Metadata = {
  // Without this, Next emits og:image as http://localhost:3000/... The build
  // succeeds, the site looks correct, and every Slack and LinkedIn preview is
  // broken. Verified by spike on 2026-09-03.
  metadataBase: new URL(SITE),
  title: "Steve Hynding — Full-stack Engineer",
  description: "Resume and portfolio of Steve Hynding, full-stack engineer and UX specialist.",
  openGraph: {
    type: "website",
    url: SITE,
    title: "Steve Hynding — Full-stack Engineer",
    description: "Resume and portfolio of Steve Hynding, full-stack engineer and UX specialist.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Steve Hynding" }],
  },
  twitter: { card: "summary_large_image" },
}
```

Create `public/og.png` — a 1200×630 PNG. A static file with a real `.png` extension is used deliberately instead of `opengraph-image.tsx`: the generated route emits an **extensionless** file that GitHub Pages will likely serve as `application/octet-stream`, which crawlers may refuse.

- [ ] **Step 2: Add a guard so the localhost bug can never ship**

Add to `tests/e2e/resume.spec.ts`:

```typescript
test("emits absolute share metadata, never localhost", async ({ request }) => {
  const html = await (await request.get("/")).text()
  const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]
  expect(ogImage).toBeTruthy()
  expect(ogImage).not.toContain("localhost")
  expect(ogImage!.startsWith("https://hynding.github.io")).toBe(true)
})
```

Run: `npm run test:e2e`
Expected: PASS, 8 tests.

- [ ] **Step 3: Write the workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm test

      - name: Materialise private data
        env:
          RESUME_PRIVATE_YAML: ${{ secrets.RESUME_PRIVATE_YAML }}
        run: |
          if [ -n "$RESUME_PRIVATE_YAML" ]; then
            printf '%s' "$RESUME_PRIVATE_YAML" > data/resume.private.yaml
            echo "private data present; vault will be sealed"
          else
            echo "no private data; building in public mode"
          fi

      - name: Build
        env:
          VAULT_PASSPHRASE_RECRUITER: ${{ secrets.VAULT_PASSPHRASE_RECRUITER }}
          VAULT_PASSPHRASE_FULL: ${{ secrets.VAULT_PASSPHRASE_FULL }}
        run: npm run build

      # Belt and braces: the export already copies public/.nojekyll, but the
      # failure it guards against is a silently unstyled site with no error in
      # the build log, so it is re-created here.
      - run: touch out/.nojekyll

      - name: Fail if a secret leaked into the output
        run: |
          if grep -rq "$(printf 'BEGIN PRIVATE')" out 2>/dev/null; then
            echo "private material found in build output"; exit 1
          fi

      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Generate passphrases and record the manual setup**

Run: `npm run vault:init recruiter` and `npm run vault:init full`

Store each printed passphrase, then set these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `RESUME_PRIVATE_YAML` | The full contents of your local `data/resume.private.yaml` |
| `VAULT_PASSPHRASE_RECRUITER` | The passphrase printed for `recruiter` |
| `VAULT_PASSPHRASE_FULL` | The passphrase printed for `full` |

Then set **Settings → Pages → Source** to **GitHub Actions**.

- [ ] **Step 5: Merge to master and verify the deploy**

```bash
git add .github app/layout.tsx public/og.png tests/e2e/resume.spec.ts
git commit -m "ci: build and deploy the static export to GitHub Pages

Sets metadataBase so share metadata resolves absolutely rather than to
localhost, and guards .nojekyll, without which Jekyll discards _next/ and the
site deploys successfully as an unstyled wall of text."
git checkout master && git merge --no-ff nextjs-refactor && git push origin master
```

Then confirm at `https://hynding.github.io`: the resume renders styled (not a wall of unstyled text — that symptom means `.nojekyll` did not take), sensitive fields read "Available on request", and a `#k=recruiter.<passphrase>` link reveals them.

---

## Self-Review

**Spec coverage.** Section 2 constraints → Task 1 and Global Constraints. Section 3 repo shape → Task 1. Section 4 data model, uniform `id`, YAML quoting rule → Tasks 2, 3, 5. Section 5 vault (audiences, optional private files, `--init` vs consume, merge-then-validate, fragment, sessionStorage, threat model) → Tasks 6, 7, 8, 11. Section 6 projects → **phase 3, deliberately not here.** Section 7 rendering → partially: `DocumentView` and the provider land here, the scene is phase 4. Section 8 themes and pre-paint → Task 9; the second template and pickers are phase 2. Section 9 print and PDF → **phase 2.** Section 10 testing → Tasks 2–12; axe-core is phase 2, when there is a second template and mode to check. Section 11 deployment → Task 13.

**Known gaps, all deliberate and phase-assigned:** print route, second template, theme and template pickers, projects, 3D scene, axe-core.

**Deviation from the spec, flagged for approval:** `generatePassphrase()` produces four groups of five Crockford-base32 symbols (100 bits) rather than six EFF-wordlist words (~77 bits). Vendoring a 7,776-word list to buy memorability is poor value when the passphrase travels by link, and the alternative is stronger.

**Type consistency.** `resolve()` returns `Resolved<T>` in Tasks 4, 10, and 11. `merge(base, patch)` keeps its signature in Tasks 5, 8, and 11. `VaultBlob` is identical in Tasks 6, 8, and 11. `Segment` is shared by Tasks 7 and 8. `loadResume`/`loadAudiences` are used as defined in Tasks 3, 11, and 12.

**Placeholder scan.** No TBD, no "handle errors appropriately", no "similar to Task N". Every code step carries the actual code.
