import { isPrivateMarker } from "../resume/resolve"
import type { AudienceTier } from "../resume/schema"

/** A path step: an object key, or an array entry addressed by id. */
export type Segment = string | { id: string }

export interface FoundMarker {
  path: Segment[]
  tier: AudienceTier
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export function findMarkers(node: unknown, trail: Segment[] = []): FoundMarker[] {
  if (isPrivateMarker(node)) return [{ path: trail, tier: node.private }]

  if (Array.isArray(node)) {
    return node.flatMap((entry) => {
      const id = isPlainObject(entry) && typeof entry.id === "string" ? entry.id : null
      return id === null ? [] : findMarkers(entry, [...trail, { id }])
    })
  }

  if (isPlainObject(node)) {
    return Object.entries(node).flatMap(([key, value]) => findMarkers(value, [...trail, key]))
  }

  return []
}

export function getAtPath(root: unknown, path: Segment[]): unknown {
  let current: unknown = root
  for (const segment of path) {
    if (current === null || current === undefined) return undefined
    if (typeof segment === "string") {
      if (!isPlainObject(current)) return undefined
      current = current[segment]
    } else {
      if (!Array.isArray(current)) return undefined
      current = current.find((entry) => isPlainObject(entry) && entry.id === segment.id)
    }
  }
  return current
}

export function setAtPath(
  root: Record<string, unknown>,
  path: Segment[],
  value: unknown,
): void {
  // A path must begin and end with an object key. The walk below consumes id
  // segments as lookaheads from a preceding string key, so an id in either
  // terminal position is not merely unsupported — it silently writes nothing,
  // or writes to the root instead of into the array entry. Fail loudly.
  if (path.length === 0) {
    throw new Error("setAtPath: path must not be empty")
  }
  const first = path[0]
  const final = path[path.length - 1]
  if (typeof first !== "string") {
    throw new Error(`setAtPath: path must start with an object key, received ${JSON.stringify(first)}`)
  }
  if (typeof final !== "string") {
    throw new Error(`setAtPath: path must end with an object key, received ${JSON.stringify(final)}`)
  }

  let container: Record<string, unknown> = root

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    const next = path[index + 1]

    if (typeof segment === "string") {
      if (container[segment] === undefined) {
        container[segment] = typeof next === "string" ? {} : []
      }
      const child = container[segment]
      if (Array.isArray(child)) {
        // The next segment is an id lookup; resolve it on this array.
        const id = (next as { id: string }).id
        let entry = child.find((item) => isPlainObject(item) && item.id === id) as
          | Record<string, unknown>
          | undefined
        if (!entry) {
          entry = { id }
          child.push(entry)
        }
        container = entry
        index += 1 // consumed the id segment
      } else {
        container = child as Record<string, unknown>
      }
    }
  }

  container[final] = value
}
