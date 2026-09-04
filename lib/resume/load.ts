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
const dataPath = (file: string) =>
  path.isAbsolute(file) ? file : path.join(process.cwd(), "data", file)

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
