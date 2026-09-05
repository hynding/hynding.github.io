import type { PrivateMarker } from "./schema"

export function isPrivateMarker(value: unknown): value is PrivateMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "private" in value &&
    "public" in value &&
    typeof (value as { public: unknown }).public === "string"
  )
}

export type Resolved<T> =
  | { value: T; locked: false }
  | { value: string; locked: true }

/**
 * Renderer-agnostic by design. `<PrivateValue>` wraps this for the DOM, the
 * scene calls it for text meshes, and the print route calls it and renders
 * the value with no lock chrome.
 */
export function resolve<T>(field: T | PrivateMarker): Resolved<T> {
  if (isPrivateMarker(field)) return { value: field.public, locked: true }
  return { value: field as T, locked: false }
}
