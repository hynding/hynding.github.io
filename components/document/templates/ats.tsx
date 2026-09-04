import type { Resume } from "@/lib/resume/schema"
import { Header } from "@/components/document/sections/Header"
import { Section } from "@/components/document/sections/Section"
import { Work } from "@/components/document/sections/Work"
import { References } from "@/components/document/sections/References"

/**
 * Single column, real headings, no meaning carried by icons, no text baked
 * into images — an applicant tracking system reads this before a human does.
 */
export function AtsTemplate({ resume }: { resume: Resume }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <Header basics={resume.basics} />

      <Section title="Summary">
        <p>{resume.basics.summary}</p>
      </Section>

      <Section title="Skills">
        <p>{resume.basics.skills.join(" · ")}</p>
      </Section>

      <Section title="Experience">
        <Work work={resume.work} />
      </Section>

      <Section title="Education">
        <ul className="space-y-1">
          {resume.education.map((entry) => (
            <li key={entry.id}>
              <span className="font-medium">{entry.institution}</span>
              <span className="text-[var(--muted)]"> — {entry.study}, {entry.year}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Certifications">
        <ul className="list-disc space-y-1 pl-5">
          {resume.certifications.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title="References">
        <References references={resume.references} />
      </Section>
    </article>
  )
}
