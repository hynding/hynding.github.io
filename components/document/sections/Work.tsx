import type { Resume } from "@/lib/resume/schema"
import { PrivateValue } from "@/components/privacy/PrivateValue"

export function Work({ work }: { work: Resume["work"] }) {
  return (
    <div className="space-y-5">
      {work.map((entry) => (
        <article key={entry.id}>
          <h3 className="font-medium">
            {entry.position}, <PrivateValue field={entry.company} />
          </h3>
          <p className="text-sm text-[var(--muted)]">{entry.duration}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {entry.responsibilities.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-[var(--muted)]">{entry.technologies.join(" · ")}</p>
        </article>
      ))}
    </div>
  )
}
