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
