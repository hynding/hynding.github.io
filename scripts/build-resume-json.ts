import fs from "node:fs"
import path from "node:path"
import { loadResume } from "../lib/resume/load"
import { jsonResume } from "../lib/seo/jsonResume"

// Emitted into public/ so the export serves it at /resume.json. Built from
// the validated PUBLIC document only — the private patch never reaches this
// script, and the CI leak guard sweeps the emitted file with everything else.
const target = path.join(process.cwd(), "public", "resume.json")
fs.writeFileSync(target, JSON.stringify(jsonResume(loadResume()), null, 2) + "\n")
console.log("[resume-json] wrote public/resume.json")
