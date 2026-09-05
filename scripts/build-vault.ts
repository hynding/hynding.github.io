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

  const patch = readYamlIfPresent(process.env.VAULT_PRIVATE_FILE ?? "resume.private.yaml")
  if (patch === null) {
    console.warn("[vault] no data/resume.private.yaml — building in public mode")
    return
  }

  const audiences = loadAudiences()

  const blobs = await buildVaults({
    resume,
    patch,
    audiences,
    passphraseFor: (audience) => process.env[`VAULT_PASSPHRASE_${audience.toUpperCase()}`],
  })

  fs.mkdirSync(VAULT_DIR, { recursive: true })
  for (const [audience, blob] of Object.entries(blobs)) {
    fs.writeFileSync(path.join(VAULT_DIR, `${audience}.json`), JSON.stringify(blob))
    console.log(`[vault] sealed ${audience}`)
  }

  // An audience entitled to no tiers that actually appear in the document
  // produces no blob. Saying so out loud is the only way drift between
  // audiences.yaml and resume.yaml becomes visible — otherwise a configured
  // passphrase is silently never used until a share link 404s.
  for (const audience of Object.keys(audiences)) {
    if (!(audience in blobs)) {
      console.warn(`[vault] ${audience}: no entitled tiers present in the document, nothing sealed`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
