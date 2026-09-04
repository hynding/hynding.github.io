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
 * Pure — the base is never mutated.
 */
export function merge(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base

  if (Array.isArray(patch)) {
    if (!Array.isArray(base)) return patch
    const out = [...base]
    for (const entry of patch) {
      if (!hasId(entry)) {
        throw new Error(`merge: every array entry needs an id, received ${JSON.stringify(entry)}`)
      }
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
