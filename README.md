# hynding.github.io

Resume and portfolio site for Steve Hynding, deployed to https://hynding.github.io.

## Architecture

There is one validated data model, `data/resume.yaml`, checked against a Zod
schema and rendered through a pluggable presentation layer — Phase 1 ships a
single ATS-friendly template; later phases add a second template, themes,
projects and a 3D mode.

The interesting piece is `resolve()`: redaction is a pure function, not a
component. It takes a field that may be a `{ private, public }` marker and
returns either the real value or its placeholder, with no dependency on React
or the DOM. That means the exact same redaction logic protects a field
whether it is rendered into the page, the print/PDF route, or (Phase 4) a
WebGL scene — there is one place the "is this locked?" decision is made, not
one per renderer.

See `docs/superpowers/specs/` for the design record and
`docs/superpowers/plans/` for the implementation plan this was built from.

## Commands

```
npm run dev          # local dev server
npm test             # 74 unit tests (vitest)
npm run test:e2e     # 10 Playwright tests; builds the static export first
npm run build        # production static export (out/)
npm run check:leak   # fail if any private value reached the build output
```

## The privacy layer

Sensitive fields — an email, a phone number, a reference's contact details —
are declared in the public `data/resume.yaml` as a marker:
`{ private: <tier>, public: <placeholder> }`. The real values live in a
gitignored `data/resume.private.yaml`, which never leaves the machine or CI
environment that has it. At build time, a per-audience patch containing only
the tiers that audience is entitled to is encrypted with AES-256-GCM under a
key derived by PBKDF2 (600,000 iterations), and only that ciphertext is
published. In the browser, a visitor unlocks their tier with a passphrase, or
a one-click `#k=<audience>.<passphrase>` link.

Being honest about the threat model: this is offline-attackable by design.
The ciphertext is public, so anyone can download it and try passphrases
against it with no rate limit. The defense is entropy, not obscurity — that's
why `npm run vault:init <audience>` generates the passphrase itself (100 bits)
rather than letting anyone choose one.

## Setup for the vault

The site builds and deploys fine with none of this configured — every gated
field simply renders as its public placeholder. To enable it:

1. Write the real values into a gitignored `data/resume.private.yaml`.
2. `npm run vault:init <audience>` (once per audience: `recruiter`, `full`) to
   generate a 100-bit passphrase for it — printed once, not written to disk.
3. Add three repository secrets: `RESUME_PRIVATE_YAML` (the private YAML
   file's contents), `VAULT_PASSPHRASE_RECRUITER`, and `VAULT_PASSPHRASE_FULL`.
4. Set the repo's Pages source to "GitHub Actions" (Settings → Pages).
