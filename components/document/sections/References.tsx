import { resolve } from "@/lib/resume/resolve"
import type { Resume } from "@/lib/resume/schema"

/**
 * A gated collection, not a gated scalar: locked it is a placeholder string,
 * unlocked it is an array. The two states do not share a render path, which
 * is why this branches rather than using PrivateValue.
 */
export function References({ references }: { references: Resume["references"] }) {
  const { value, locked } = resolve(references)

  if (locked) {
    return <p className="italic text-[var(--muted)]">{value}</p>
  }

  return (
    <ul className="space-y-2">
      {value.map((reference) => (
        <li key={reference.id}>
          <span className="font-medium">{reference.name}</span>
          <span className="text-[var(--muted)]"> — {reference.title}</span>
          <div className="text-sm text-[var(--muted)]">{reference.contact}</div>
        </li>
      ))}
    </ul>
  )
}
