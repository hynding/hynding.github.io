# Portfolio & Resume Site — Design

**Date:** 2026-09-03
**Status:** Approved for planning
**Repo:** `hynding/hynding.github.io`

## 1. Context

The repository currently serves a broken placeholder (`index.html` renders the
literal text `abc`). Behind it sit three unfinished efforts: a root-level
JavaScript playground whose files do not parse, an untouched `create-next-app`
scaffold under `packages/nextjs`, and a stale Create React App Three.js demo
under `packages/three-demo`. Resume data exists in three drifting copies with
two different schemas.

The goal is a single professional site that serves as both resume and
portfolio, with visual ambition that argues for the author's skill rather than
merely asserting it.

### Goals

1. A fast, accessible, ATS-parseable resume that a recruiter can read, print,
   and forward.
2. A portfolio of project work that leads with outcomes rather than
   technologies.
3. A 3D presentation mode that is a genuine second reading of the same data,
   not decoration.
4. Sensitive data — contact details, references, client identities, full work
   history — withheld from the public web but shareable with one link.
5. A codebase whose structure is itself evidence of the author's judgment.

### Non-goals

- A CMS, blog, or comment system.
- Server-side rendering, user accounts, or any runtime backend.
- Analytics that track individual visitors.

## 2. Constraints

These are hard and they shape every decision below.

- **Static export only.** The site deploys to GitHub Pages via
  `output: "export"`. No server, no route handlers, no middleware, no
  incremental regeneration, no runtime environment secrets. Filesystem reads
  happen at build time or not at all.
- **The repository is public.** GitHub Pages on a free account requires it.
  Therefore plaintext sensitive data must never be committed, because git
  history is effectively permanent and reaches forks and caches that a
  force-push does not.
- **Root deployment.** The site is a user page at `hynding.github.io`, so no
  `basePath` or `assetPrefix` is required.
- **Anything shipped to the browser is public.** Obfuscation is not privacy.
  The privacy layer must be cryptographic to mean anything.

## 3. Repository shape and stack

The monorepo collapses to a single application at the repository root.

```
/
├── .github/workflows/deploy.yml
├── app/
│   ├── layout.tsx                   # fonts, pre-paint script, metadata
│   ├── page.tsx                     # AppShell + default document mode
│   ├── not-found.tsx
│   ├── print/[template]/page.tsx    # print-optimised route per template
│   └── globals.css
├── components/
│   ├── shell/       AppShell · ModeToggle · ThemePicker · TemplatePicker · UnlockControl
│   ├── document/    templates/{ats,classic}.tsx · sections/*.tsx
│   ├── scene/       Scene · CareerRibbon · SkillField · ProjectCards   (lazy)
│   └── privacy/     UnlockDialog · PrivateValue
├── lib/
│   ├── resume/      schema.ts · load.ts · merge.ts · resolve.ts · types.ts
│   ├── vault/       crypto.ts · encrypt.node.ts · decrypt.browser.ts
│   ├── theme/       themes.ts · templates.ts
│   └── layout/      flip.ts                       (phase 5)
├── data/
│   ├── resume.yaml              # public — committed
│   ├── projects.yaml            # public — committed
│   ├── audiences.yaml           # public — committed
│   ├── resume.private.yaml      # GITIGNORED
│   └── projects.private.yaml    # GITIGNORED
├── public/
│   ├── .nojekyll
│   ├── fonts/                   # self-hosted, needed by the 3D text renderer
│   └── vault/*.json             # GENERATED, gitignored
├── scripts/build-vault.ts
├── tests/
│   ├── unit/                    # vitest
│   ├── e2e/                     # playwright
│   └── fixtures/                # own resume + own vault passphrase
└── next.config.ts · package.json · tsconfig.json · vitest.config.ts · playwright.config.ts
```

### Removed

| Path | Reason |
| --- | --- |
| `index.html`, `index.js`, `app.js` | Placeholder; `app.js` is empty |
| `services.js`, `search-trees.js` | Do not parse — invalid syntax |
| `google-example.html` | Verbatim copy of Google's `gapi.auth2` sample; that library was retired in 2023 |
| `packages/three-demo/` | CRA, React 18, `three@0.141`, uses the removed `boxBufferGeometry` API |
| `packages/nextjs/steve-hynding.yaml` | Byte-identical duplicate |
| `packages/nextjs/out/` | Committed build artefact; becomes gitignored |
| `packages/` | Emptied by the above |

### Stack

Retained: Next 15.4.7 · React 19 · Tailwind v4 · TypeScript · `js-yaml`.

Added: `zod` (major version pinned — Zod 4 changed API surface) · `three`
with `@react-three/fiber` v9 and `@react-three/drei` v10 (the React 19 line) ·
`motion` · `vitest` with Testing Library · `@playwright/test` · `tsx`.

**Verified by spike, 2026-09-03.** `next@15.4.7` · `react@19.1.0` ·
`three@0.185.1` · `@react-three/fiber@9.7.0` · `@react-three/drei@10.7.8`
install with no peer conflicts and build cleanly under `output: "export"` on
Node 22. A `dynamic(..., { ssr: false })` scene keeps First Load JS at 101 kB,
with Three.js isolated in separate 384 KB chunks that contain no reference to
`WebGLRenderer` — the code-splitting claim in section 7 holds in practice, not
just in principle.

`next-themes` is deliberately **not** used. Section 8 already requires a custom
blocking pre-paint script because template choice is structural, and that
script covers the colour axis at no extra cost. Reconciling a palette axis that
includes a dark-only theme with `next-themes`' `theme`/`resolvedTheme` model is
fiddlier than the twenty lines it would replace.

### Path resolution

`lib/getResume.ts` currently calls
`fs.readFileSync("../resume/steve-hynding.yaml")`, a path relative to the
process working directory. It works only when `next dev` runs from inside
`packages/nextjs` and fails under any test runner, script, or CI step with a
different CWD. The replacement resolves from the application root, which is now
the repository root.

## 4. Data model

`data/resume.yaml` becomes the single source of truth. The richer structure of
the existing `data/resume.yaml` is kept; the two `steve-hynding.yaml` copies
are folded into it and deleted.

Zod validates the document at build time, so a malformed field fails the build
rather than rendering `undefined` into a recruiter's browser.

### Declaring sensitive fields

Sensitive slots are declared in the public file, not omitted from it. The
public file always states what a value would be and who may see it:

```yaml
basics:
  name: Steve Hynding
  email:
    private: contact
    public: Available on request
work:
  - id: bcg
    company:
      private: clients
      public: Global management consultancy
```

```ts
type AudienceTier = 'contact' | 'references' | 'clients' | 'full'
type PrivateMarker = { private: AudienceTier; public: string }
type Maybe<T> = T | PrivateMarker
```

### Resolution

The private data is authored as a **partial tree mirroring the public
document**, so unlocking is a deep merge rather than a per-field lookup:

```yaml
# data/resume.private.yaml — gitignored
basics:
  email: steve.hynding@example.com
work:
  - id: bcg
    company: Boston Consulting Group
```

**Every array entry carries a required `id`, and arrays merge by `id`, never by
index.** Positional merging would force a patch that wants to touch only the
second of three jobs to be written as `[null, {…}, null]`, and — worse —
reordering the public file would silently apply private values to the wrong
entries with no error anywhere. Keying by `id` makes the patch
order-independent and reorder-safe.

The rule is **uniform: every array entry in either document carries an `id`**,
enforced by a shared Zod base. The alternative — requiring ids only on
"patchable" arrays — is not knowable without scanning for markers, and nested
arrays are genuinely patchable (a confidential metric inside a project's
`outcomes` is an ordinary case). A uniform rule costs slightly noisier YAML and
removes a class of silent corruption along with all the case analysis.

Merging is total for objects and keyed for arrays; a scalar in the patch
replaces whatever the public document held at that path. An `id` in the patch
matching no public entry is **appended**, and a patch array arriving where the
public document holds a private marker **replaces** it. Neither is an edge
case: they are the mechanism by which confidential projects and the entire
references list arrive.

After the merge, private markers are simply replaced by real values. Resolution
is therefore trivial and, critically, **renderer-agnostic**:

```ts
resolve<T>(field: Maybe<T>): { value: T | string; locked: boolean }
```

`resolve()` is a pure function. `<PrivateValue>` is a thin DOM wrapper that adds
a lock affordance; the 3D scene calls `resolve()` directly for text meshes; the
print route calls it and renders the value with no lock chrome. One redaction
rule, three presentations. A React component alone would not have worked,
because a `<span>` is meaningless inside a WebGL canvas.

`<PrivateValue>` covers **scalars only**. A gated collection such as
`references` is a placeholder string when locked and an array of objects when
unlocked, so its section branches on `locked` explicitly rather than pretending
the two states share a render path.

### YAML authoring rule

**Quote every date-like scalar.** Under `js-yaml`, an unquoted scalar is
coerced by its shape: `2000` becomes a **number**, `2023-01-01` becomes a
JavaScript **`Date`**, and `2023-01` stays a string. The first two both fail
`z.string()`, and which one you get depends on how the value happens to be
written — a confusing failure. The schema therefore requires quoted strings and
the build rejects both numbers and `Date` instances where a string is
expected.

## 5. Privacy — the vault

### Model

Encryption is per **audience**, not per field. An audience is a person or class
of person the author is talking to; its blob contains everything that audience
may see. This avoids a key hierarchy, and lets one recipient's access be burned
without touching another's. Duplication between blobs costs a few hundred
bytes.

```yaml
# data/audiences.yaml
recruiter: [contact, clients]
full:      [contact, clients, references, full]
```

### Build (`scripts/build-vault.ts`, runs as `prebuild`)

1. Load and validate the public documents.
2. **If no private files are present, emit no vault, log a warning, and stop
   here.** The build then succeeds and the site renders every gated field as
   its `public` placeholder. This is the normal state for a fresh clone, a
   fork, and any local session that is not the author's — a public repository
   that cannot be built by the public would be a defect, not a safeguard.
3. With private files present, walk the public documents for private markers,
   recording each path and its tier. A marker with no corresponding value now
   **fails the build**, which is the invariant that prevents shipping a
   permanently unresolvable lock.
4. Load `projects.private.yaml`, whose entries are whole projects, each tagged
   with a tier and carrying an `id` like any other entry.
5. For each audience, assemble the patch containing only the paths and projects
   whose tier that audience is entitled to. **Merge it into the public model,
   validate the *result* against the full schema**, then discard the merged
   document and keep only the patch. Validating the patch directly is
   impossible — a partial tree fails every required field — and would demand a
   hand-maintained deep-partial mirror of the schema that drifts immediately.
   Validating the merged result needs no second schema and additionally catches
   a private value landing where it does not typecheck.
6. Derive a key: PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte random salt.
7. Encrypt with AES-256-GCM and a 12-byte random IV. GCM authenticates, so a
   wrong passphrase fails cleanly rather than yielding plausible garbage.
8. Write `public/vault/<audience>.json`:
   `{ v: 1, audience, kdf: { name, hash, iterations, salt }, iv, ct }`.

Salt and IV are regenerated per build. The blob is self-describing, so existing
passphrases remain valid. Deriving the salt from a content hash instead would
keep an unchanged vault byte-stable across deploys and spare returning visitors
a re-download; worth doing only if it costs nothing.

### Passphrases

The script has two distinct modes, because generating and consuming a
passphrase are different jobs and conflating them would mint a new passphrase
on every CI build, invalidating every link already sent.

- `build-vault --init <audience>` **generates** a passphrase — four groups of
  five Crockford base32 symbols, 100 bits, e.g. `k3m9p-x2vqa-7htnr-wd4je` —
  prints it once for the author to store, and exits. This supersedes an earlier
  choice of six EFF-wordlist words (~77 bits): vendoring a 7,776-word list to
  buy memorability is poor value for a passphrase that travels inside a share
  link, and the base32 form is stronger.
- The normal build path **consumes** `VAULT_PASSPHRASE_<AUDIENCE>` from the
  environment, and fails loudly if private files exist but the variable does
  not.

The author never invents a passphrase. See the threat model below for why this
is not optional.

### Runtime

Unlocking proceeds as: passphrase → PBKDF2 in WebCrypto → AES-GCM decrypt →
deep-merge into the model → **validate the merged document with Zod** →
re-render through React context. The order matters: a partial patch cannot be
validated on its own, so validation follows the merge rather than preceding
it.

The re-validation is not defensive theatre. The build is the only trusted
execution context in a static site, so anything arriving after it — a decrypted
blob, a URL fragment, restored browser storage — is untrusted input even when
the author wrote it. Without this step a malformed private file fails at
runtime in the browser of the single person the author most wanted to impress.
On validation failure the application stays locked and reports a generic error;
details surface only in development.

A `#k=<audience>.<passphrase>` fragment unlocks in one click, **split on the
first `.` only** so that a dot in an audience name or word list cannot make the
format ambiguous. Fragments are never transmitted to the server nor recorded in
Pages logs, so the passphrase stays client-side by construction. The page
consumes it and clears it with `history.replaceState` so it does not persist in
history or a screen-shared address bar.

The audience prefix exists for cost, not convenience. Derivation at 600,000
iterations is roughly 300–400 ms on a laptop but plausibly two to three seconds
on a mid-range phone, so attempting every blob in turn would multiply an
already noticeable delay for exactly the recruiter reading on a train. With the
prefix, one derivation runs. Manual passphrase entry without a prefix falls
back to trying each blob, behind an explicit pending state.

The decrypted patch is held in **`sessionStorage`, never `localStorage`**, so a
recruiter on a shared machine does not leave references behind. An explicit
Lock control clears it.

### Private projects

A project that is wholly confidential lives in `projects.private.yaml` in its
entirety and is merged in only after decryption. It is **not** a public project
carrying a `visibility: private` flag — that would place the whole record in a
public repository behind nothing but a UI condition.

Its images are subject to the same rule. A file in `public/` is fetchable at a
guessable URL no matter what the vault does, so a private project either ships
without images or has them encrypted into the blob as data URIs under a
per-image budget of roughly 250 KB.

Merged-in private projects append to the projects array, as section 4
specifies for any unmatched `id`. Display order, however, is not insertion
order: **all projects sort by `period.end` descending**, so unlocking
interleaves confidential work into the timeline in its true place rather than
clustering it at the end.

The public file may carry a deliberate stub — *"3 additional client engagements
available on request"* — so that the omission reads as a signal rather than a
gap.

### Threat model

This scheme is **offline-attackable**. The ciphertext is public, so an attacker
can grind passphrases locally with no rate limit. Exactly one thing therefore
matters: passphrase entropy. A human-chosen phrase is worth perhaps 30 bits and
falls in hours; the generated 100-bit phrase, at 600,000 KDF iterations, does
not.

Revocation is the honest weakness. Publishing ciphertext is irreversible for
anyone who already downloaded it, so rotating a passphrase protects future
disclosure but not past. This is an acceptable trade for contact details and
client names, and it is why audiences are kept separate.

**The `public:` placeholder is itself a disclosure decision, not a safe
default.** "Global management consultancy" beside "April 2016 – Present" and a
public LinkedIn profile identifies the employer immediately. The vault protects
the ciphertext; it cannot launder a placeholder that gives the answer away.
Each placeholder is an authored redaction and carries the author's editorial
judgment.

## 6. Projects — the portfolio model

The schema is outcome-first by design. A project list that leads with
technology reads junior; one that leads with a problem reads senior.

```yaml
projects:
  - id: iot-fleet-console
    title: Real-time fleet console for 12k industrial devices
    client:
      private: clients
      public: Industrial equipment manufacturer
    period: { start: "2023-01", end: "2023-11" }
    role: Lead engineer
    team: 4 engineers · 1 designer · 1 PM
    problem: >
      Operators triaged faults from a nightly spreadsheet export, so a failure
      discovered at 09:00 had usually been live since the previous afternoon.
    approach:
      - Streamed device telemetry into a windowed aggregation layer.
      - Replaced the export with a live severity-ranked queue.
    outcomes:
      - id: triage-time
        label: Time to triage a fault
        from: ~40 min
        to: under 3 min
      - id: reach
        label: Deployed to
        value: 40 countries
    stack: [TypeScript, React, D3, AWS IoT, Python]
    artifacts:
      - id: overview
        kind: image
        src: /projects/iot-console.png
        alt: Console overview
      - id: writeup
        kind: writeup
        href: "https://…"
    featured: true
    scene: { accent: cyan, form: ribbon }
```

`outcomes` is structured `from`/`to` so every metric renders as a consistent
delta rather than freeform prose, with a `{ label, value }` variant for figures
that have no meaningful *from*. Every entry carries an `id` under the uniform
rule in section 4, which is what lets a private patch target a single
confidential metric. `scene` keeps 3D presentation hints in data, so adding a
project never requires editing scene code. `artifacts` is a discriminated union
on `kind`.

## 7. Rendering architecture

One validated model, two peer renderers, one persistent shell.

```
data/*.yaml ──▶ parse + Zod ──▶ Resume · Projects  (pure model)
                                   ╱          ╲
                     DocumentRenderer        SceneRenderer
                       (templates)            (r3f, lazy)
                                   ╲          ╱
                                    AppShell
                        toggle · theme · template · unlock
```

`ResumeProvider` holds the merged, validated model — public data alone when
locked, public merged with the decrypted patch when unlocked.
`usePresentation()` holds `{ mode, template, theme }`. `AppShell` never
unmounts; switching mode swaps only the renderer beneath it.

### Loading and capability

The scene is loaded with `dynamic(..., { ssr: false })`, so Three.js — roughly
600 KB — never enters the initial bundle. The 2D document is the default and
the accessibility source of truth.

The mode toggle is **disabled, with a stated reason, only when no WebGL context
is available**. It is never silently absent; honest degradation reads better
than a hidden feature.

`prefers-reduced-motion` **adapts** the scene rather than removing it: static
camera, no auto-orbit, no parallax, instant mode transitions. Reduced motion
means do not animate, not do not show; removing capability instead of adapting
it is an accessibility anti-pattern.

### Scene content

Three legible acts, each a second reading of data the document also shows:
**CareerRibbon** (experience along a depth axis), **SkillField** (instanced
points clustered by category), **ProjectCards** (featured projects as planes
textured with their artifacts). A 3D mode that is only pretty is a liability in
a portfolio.

### Interaction

**The canvas does not hijack page scroll.** Scroll-jacking captures the page,
behaves erratically on trackpads, and traps the user. Navigation between acts
is explicit — controls and arrow keys — and dragging orbits within the current
act only.

### Scene text

`drei`'s `<Text>` uses troika, which requires a fetchable font file URL.
`next/font` produces CSS, not a path, so the display font is **self-hosted in
`public/fonts/`** and referenced by both the stylesheet and the scene. SDF text
is invisible to assistive technology, which is another reason the 2D document
remains the accessibility source of truth.

### Transitions

The shipped default is a designed cut: depth-push and crossfade, roughly
450 ms, driven by `motion` and reduced-motion aware.

A FLIP-style cross-renderer morph — measuring DOM rects and using them as entry
targets for 3D objects under an orthographic camera, so screen pixels map to
world units — is deferred to phase 5. Its failure mode is not a crash but a
transition that is *almost* right and reads as janky, so it must sit on top of
a cut that already looks intentional.

## 8. Themes and templates

The axes are orthogonal: **templates control structure, themes control skin.**

**Three themes**, each a complete token set: Slate (cool neutral, default), Ink
(warm paper, serif-friendly), Terminal (mono, high contrast, declared
`darkOnly` because a light Terminal is a lie). Tokens are defined once in
`themes.ts` and emitted both as CSS custom properties for the DOM and as a
plain object the scene reads for materials, fog, and lighting — so a theme is
coherent across both modes by construction.

Scene-specific values are **derived from the base palette** by a documented
function, with optional per-theme overrides, so adding a theme does not require
understanding the 3D pipeline.

**Two templates** ship first: `ats` (single column, plain, parseable) and
`classic` (two column). Both implement
`TemplateProps { resume, projects, resolve }` and register in `templates.ts`; a
third is a new file plus a registry line. Templates take `projects` from the
outset even though the portfolio arrives in phase 3 — until then it is an empty
array, so no template signature changes when the projects land.

Two done well beat four done adequately — sixteen theme×template combinations
is more than anyone actually reviews, so several would quietly look bad.

### Pre-paint

Theme and template are read from `localStorage` by a **single blocking script
in `<head>`**. Template affects structure, so a flash of the wrong layout is far
worse than a flash of the wrong colour and cannot wait for hydration.

## 9. Print and PDF

`app/print/[template]/page.tsx` with `generateStaticParams` over the template
registry: no shell chrome, no lock affordances,
`@page { size: letter; margin: 0.5in }`, and `break-inside: avoid` on every
entry.

The route renders inside `ResumeProvider` but **without `AppShell`** — it needs
the merged model, but none of the chrome.

Export is a **same-tab navigation** to `/print/ats?auto=1`, where the route
calls `window.print()` on mount. Opening a popup and calling `print()` across
tabs is blockable and unreliable, and same-tab navigation keeps `sessionStorage`
— and therefore the unlocked values — intact by construction.

Printing **awaits `document.fonts.ready` and one animation frame** before
calling `print()`. Firing on mount races font loading, and the failure is
silent and intermittent: a PDF typeset in the fallback font, discovered only
when a recruiter forwards it back.

The print route sets `<title>` to `Steve Hynding — Resume`, because browsers
name the generated PDF from it and that filename is what sits in a recruiter's
downloads folder.

PDF generation deliberately uses the browser's own print engine rather than a
canvas rasteriser. The common `html2canvas` → `jsPDF` route produces a PDF whose
text is a picture of text, from which applicant tracking systems extract
nothing — precisely inverting the purpose. The `ats` template additionally
holds the line on parseability: real heading elements, single column, no
meaning carried by icons, no text baked into images.

## 10. Testing

**Vitest (unit).** The schema accepts valid fixtures and rejects malformed
ones, including `Date` coercion from unquoted YAML. The vault round-trips —
encrypted in Node, decrypted through WebCrypto. `resolve()` redacts correctly
both locked and unlocked. Every theme defines every token, which is the test
that stops a half-finished palette from shipping.

The merge is covered in both directions, because it is the mechanism most
likely to fail silently: patches apply by `id` regardless of array order,
unmatched ids append, and a merged document that violates the schema fails the
build. Both branches of the private-files check are tested — **the build
succeeds and renders placeholders when no private files exist** (the path every
fork and fresh clone takes), and fails when they exist but a marker has no
corresponding value.

**Playwright (end to end).** The default 2D view renders real content. The
unlock flow reveals values and the lock control clears them. Template choice
survives a reload with no layout flash. The print route renders and carries
unlocked values. The 3D toggle either lazy-loads or is disabled with a stated
reason.

An **axe-core pass** runs against both templates and both modes. For a site
whose argument includes accessible 3D, an automated check is cheap and
load-bearing.

Tests build **their own vault** from `tests/fixtures/` with a known passphrase.
The real passphrase never touches a test.

## 11. Deployment

`.github/workflows/deploy.yml`, on push to `master`: `npm ci`, test, build,
`upload-pages-artifact`, `deploy-pages`, pinned to Node 20 or later.
`resume.private.yaml`, `projects.private.yaml`, and the audience passphrases
are stored as repository secrets and materialised to disk only inside the
runner. The repository's Pages
source is set to "GitHub Actions" once, manually.

Two static-export requirements, both documented because each fails
confusingly:

- **`.nojekyll` is mandatory**, written to `public/`. A spike confirmed that
  the export copies dotfiles from `public/` into `out/`, so the additional
  `touch out/.nojekyll` in the workflow is belt-and-braces rather than
  required — it stays because it costs nothing and the failure it guards
  against is silent. GitHub Pages runs Jekyll by default, and
  Jekyll silently discards every directory beginning with an underscore. Next
  places the entire JavaScript and CSS payload in `_next/`. The result is a
  deploy that reports success, serves the HTML, and 404s every asset — an
  unstyled wall of text with no error anywhere in the build log.
- **`images.unoptimized: true`** is required under `output: "export"`, because
  the default `next/image` loader needs a running server. This one fails the
  build, which is kinder.

Work proceeds on `nextjs-refactor` and merges to `master` at the end of phase
1, which is the point at which the live site stops being a placeholder.

Metadata for link sharing — title, description, and an OG image — is part of
phase 2. It is the first thing anyone sees when the URL is pasted into Slack or
LinkedIn.

Image generation was spiked on 2026-09-03 rather than assumed. Three findings,
all of which change what phase 2 must do.

**`opengraph-image.tsx` does work under `output: "export"`, but only with
`export const dynamic = "force-static"`.** Without it the build fails outright
at page-data collection, naming the missing export in the error. With it, a
1200×630 PNG is emitted at build time.

**`metadataBase` must be set, and this is the dangerous one.** Left unset, the
build succeeds and emits
`<meta property="og:image" content="http://localhost:3000/opengraph-image?…">`.
The site looks perfect and every link preview on Slack and LinkedIn is broken,
pointing at the sharer's own machine. The failure is silent, production-only,
and invisible to local testing — exactly the profile of a bug that ships.

**The generated file has no extension** (`out/opengraph-image`). GitHub Pages
will most likely serve it as `application/octet-stream`, and crawlers may
refuse a non-image content type. This cannot be confirmed without deploying, so
phase 2 **sidesteps it**: a real `public/og.png` referenced explicitly from
`metadata.openGraph.images`. Generating that PNG with a build-time script
remains available, but the artifact it produces has a `.png` extension and a
content type Pages is certain to get right.

## 12. Sequencing

| Phase | Ships | Live result |
| --- | --- | --- |
| 1 · Foundation | Repo cleanup, model and schema, vault, `ats` template, one theme, CI and Pages | A real site replaces the placeholder |
| 2 · Presentation | `classic` template, three themes, pickers, print and PDF, share metadata | Complete 2D product |
| 3 · Portfolio | Projects schema, sections, artifacts, per-project gating | Resume **and** portfolio |
| 4 · Dimension | 3D scene, lazy loading, capability gating, designed-cut transition | The showpiece |
| 5 · Stretch | FLIP cross-renderer morph, polish | Flair |

Phase 1 is the one that matters: it puts a working, professional site at the
author's URL. Every later phase is additive on something already good. A
portfolio that is sixty percent built and deployed beats one that is fully
designed and unpublished.

## 13. Rejected alternatives

**An authenticated API on `stevehynding.com`** for private data. Strongest
revocation and audit story, but it requires a backend, CORS, and hosting to
maintain for a resume site.

**Two builds, public and private**, the latter behind Netlify or Cloudflare
Access. Simple to reason about and needs no client cryptography, but requires a
second host and keeps two artifacts in sync.

**Obfuscation without encryption.** Deters scrapers, not people. Acceptable for
an email address, wrong for references and client names.

**3D as the default with 2D as fallback.** Maximum flair, inverted risk: a
recruiter on a locked-down machine meets the fallback first.

**A document site with a separate `/studio` 3D route.** Lower risk, but the
mode toggle becomes navigation and the "same data, two presentations" argument
is lost. The adapter split means this remains reachable later if scope demands.
