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
      aria-label={`${value} — withheld until unlocked`}
      className="italic text-[var(--muted)] underline decoration-dotted underline-offset-4"
    >
      {value}
    </span>
  )
}
