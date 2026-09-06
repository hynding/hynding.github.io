import { isPrivateMarker } from "../resume/resolve"
import type { Resume } from "../resume/schema"

/**
 * schema.org Person structured data, built from the PUBLIC model only.
 *
 * Locked fields are omitted entirely rather than rendered as placeholders:
 * "Available on request" is not an email address, and structured data that
 * advertises a hidden field is worse for an agent than no field at all.
 * References never appear here in either state.
 */
export function personJsonLd(resume: Resume): Record<string, unknown> {
  const { basics } = resume

  const person: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${basics.website}/#person`,
    name: basics.name,
    jobTitle: basics.role,
    url: basics.website,
    description: basics.summary,
    knowsAbout: basics.skills,
  }

  if (basics.location) person.address = basics.location
  if (basics.profiles && basics.profiles.length > 0) {
    person.sameAs = basics.profiles.map((profile) => profile.url)
  }

  if (!isPrivateMarker(basics.email)) person.email = `mailto:${basics.email}`
  if (!isPrivateMarker(basics.phone)) person.telephone = basics.phone

  const current = resume.work[0]
  if (current && !isPrivateMarker(current.company)) {
    person.worksFor = { "@type": "Organization", name: current.company }
  }

  if (resume.education.length > 0) {
    person.alumniOf = resume.education.map((entry) => ({
      "@type": "EducationalOrganization",
      name: entry.institution,
    }))
  }

  return person
}

/** Serialized for an inline <script>; "<" is escaped so markup in a value can never close the tag. */
export function jsonLdScript(resume: Resume): string {
  return JSON.stringify(personJsonLd(resume)).replace(/</g, "\\u003c")
}
