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
