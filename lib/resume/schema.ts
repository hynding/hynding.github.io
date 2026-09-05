import { z } from "zod"

export const AUDIENCE_TIERS = ["contact", "references", "clients", "full"] as const

export const tierSchema = z.enum(AUDIENCE_TIERS)
export type AudienceTier = z.infer<typeof tierSchema>

/**
 * A declared-but-withheld value. The public document always states what the
 * value would be and who may see it, so the UI renders an affordance rather
 * than a hole.
 */
export const privateMarkerSchema = z
  .object({
    private: tierSchema,
    public: z.string().min(1),
  })
  .strict()

export type PrivateMarker = z.infer<typeof privateMarkerSchema>

/** A slot that may hold either a real value or a private marker. */
export const maybePrivate = <T extends z.ZodTypeAny>(inner: T) =>
  z.union([privateMarkerSchema, inner])

/**
 * Every array entry carries an id so that private patches merge by key rather
 * than by position. Positional merging silently misapplies values when the
 * public document is reordered.
 */
const entryId = z.string().min(1)

/**
 * Presence of an id is not enough. `merge()` locates entries with findIndex,
 * so a duplicate id makes the second entry unreachable and silently lands
 * every patch on the first — which is exactly the class of failure the id
 * rule exists to prevent.
 */
const uniqueById = <T extends z.ZodTypeAny>(entry: T) =>
  z.array(entry).superRefine((entries, ctx) => {
    const seen = new Set<string>()
    entries.forEach((item, index) => {
      const { id } = item as { id: string }
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `duplicate id "${id}"`,
        })
      }
      seen.add(id)
    })
  })

export const workEntrySchema = z.object({
  id: entryId,
  company: maybePrivate(z.string()),
  position: z.string(),
  duration: z.string(),
  responsibilities: z.array(z.string()),
  technologies: z.array(z.string()),
})

export const educationEntrySchema = z.object({
  id: entryId,
  institution: z.string(),
  year: z.string(),
  study: z.string(),
})

export const referenceEntrySchema = z.object({
  id: entryId,
  name: z.string(),
  title: z.string(),
  contact: z.string(),
})

export const resumeSchema = z.object({
  basics: z.object({
    name: z.string(),
    role: z.string(),
    website: z.string().url(),
    summary: z.string(),
    email: maybePrivate(z.string()),
    phone: maybePrivate(z.string()),
    skills: z.array(z.string()),
  }),
  work: uniqueById(workEntrySchema),
  education: uniqueById(educationEntrySchema),
  certifications: z.array(z.string()),
  references: maybePrivate(uniqueById(referenceEntrySchema)),
})

export type Resume = z.infer<typeof resumeSchema>
export type WorkEntry = z.infer<typeof workEntrySchema>
export type ReferenceEntry = z.infer<typeof referenceEntrySchema>
