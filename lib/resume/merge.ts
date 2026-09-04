const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const hasId = (value: unknown): value is { id: string } =>
  isPlainObject(value) && typeof value.id === "string"

/**
 * Deep-merges a private patch into the public model.
 *
 * Arrays merge by `id`, never by position: a patch must survive the public
 * document being reordered, and positional merging would silently apply a
 * value to the wrong entry. An id absent from the base is appended, which is
 * how wholly-confidential entries arrive.
 *
 * Neither input is ever mutated. The result is not a deep clone, though:
 * subtrees the patch does not touch are shared by reference with the base,
 * which is ordinary persistent-update behaviour. `merge(base, undefined)`
 * therefore returns the base itself. Callers must treat the result as
 * read-only — both call sites pass it straight to `resumeSchema.parse()`,
 * which does not mutate its input.
 */
export function merge(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base

  if (Array.isArray(patch)) {
    // Validate every entry before branching. Checking inside the merge loop
    // below would skip validation entirely on the replace path, so the same
    // id-less entry would throw or not depending on the base's shape.
    for (const entry of patch) {
      if (!hasId(entry)) {
        throw new Error(`merge: every array entry needs an id, received ${JSON.stringify(entry)}`)
      }
    }

    if (!Array.isArray(base)) return patch
    const out = [...base]
    for (const entry of patch) {
      const index = out.findIndex((existing) => hasId(existing) && existing.id === entry.id)
      if (index === -1) out.push(entry)
      else out[index] = merge(out[index], entry)
    }
    return out
  }

  if (isPlainObject(patch) && isPlainObject(base)) {
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) {
      out[key] = merge(base[key], value)
    }
    return out
  }

  return patch
}
