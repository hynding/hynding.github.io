import { resolve } from "@/lib/resume/resolve"
import type { PrivateMarker } from "@/lib/resume/schema"

/**
 * A thin DOM wrapper over `resolve()`. The primitive itself is a pure
 * function so the scene and the print route can share it — a span would be
 * meaningless inside a WebGL canvas.
 */
export function PrivateValue({ field }: { field: string | PrivateMarker }) {
  const { value, locked } = resolve(field)

  if (!locked) return <span data-locked="false">{value}</span>

  return (
    <span
      data-locked="true"
      className="italic text-[var(--muted)] underline decoration-dotted underline-offset-4"
    >
      {value}
      {/*
        Real visually-hidden text, not aria-label. A bare <span> has the ARIA
        `generic` role, whose name computation is "prohibited" — user agents
        are told not to derive an accessible name from aria-label on it, and
        support for that rule is inconsistent. Actual text content is
        unambiguous, and it composes with the visible placeholder instead of
        replacing it the way a computed name would.
      */}
      <span className="sr-only"> — withheld until unlocked</span>
    </span>
  )
}
