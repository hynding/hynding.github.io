import fs from "fs"
import yaml from "js-yaml"

export function getResume() {
  const resumeYaml = fs.readFileSync("../resume/steve-hynding.yaml", "utf8")
  const resume = yaml.load(resumeYaml) as { name: string; };

  return resume
}