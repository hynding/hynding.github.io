import fs from "node:fs"
import path from "node:path"
import yaml from "js-yaml"

const OUT = path.join(process.cwd(), "out")
const PRIVATE = path.join(process.cwd(), "data", "resume.private.yaml")

interface Secret {
  path: string
  value: string
}

/**
 * Every string worth checking. Values shorter than six characters produce
 * false positives against ordinary page text.
 */
function collect(node: unknown, trail: string[] = [], into: Secret[] = []): Secret[] {
  if (typeof node === "string") {
    const value = node.trim()
    if (value.length >= 6) into.push({ path: trail.join(".") || "(root)", value })
  } else if (Array.isArray(node)) {
    node.forEach((item, index) => collect(item, [...trail, String(index)], into))
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) collect(value, [...trail, key], into)
  }
  return into
}

function readAll(dir: string): string {
  let text = ""
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    text += entry.isDirectory() ? readAll(full) : fs.readFileSync(full, "utf8")
  }
  return text
}

if (!fs.existsSync(PRIVATE)) {
  console.log("[leak-check] no private data in this build; nothing to check")
  process.exit(0)
}

if (!fs.existsSync(OUT)) {
  console.error("[leak-check] out/ does not exist — did the build run?")
  process.exit(1)
}

const secrets = collect(yaml.load(fs.readFileSync(PRIVATE, "utf8")))
const haystack = readAll(OUT)

// Report the PATH, never the value. A CI log is not a secret store, and a
// guard that prints what leaked would leak it a second time.
const leaked = secrets.filter((secret) => haystack.includes(secret.value)).map((s) => s.path)

if (leaked.length > 0) {
  console.error(`[leak-check] private values present in out/: ${leaked.join(", ")}`)
  process.exit(1)
}

console.log(`[leak-check] ${secrets.length} private values checked, none present in out/`)
