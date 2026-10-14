import { z } from "zod";
import { isValidLocalDate, MS_PER_DAY, parseTimeOfDay, zonedTimeToInstant } from "@/lib/dates";
import { ACTIVITY_STATUSES } from "@/lib/types";

export const ACTIVITY_TITLE_MAX = 120;
export const ACTIVITY_NOTES_MAX = 2000;
export const ACTIVITY_MAX_DURATION_MS = MS_PER_DAY;

const MIN_INSTANT = Date.parse("1970-01-01T00:00:00Z");
const MAX_INSTANT = Date.parse("2200-01-01T00:00:00Z");

/** Problems with a start/end pair, keyed for display on the end field. */
export function activityTimeError(startMs: number, endMs: number): string | null {
  if (!(endMs > startMs)) return "End must be after the start";
  if (endMs - startMs > ACTIVITY_MAX_DURATION_MS) return "An activity can last at most 24 hours";
  if (startMs < MIN_INSTANT || endMs >= MAX_INSTANT) return "Choose a date between 1970 and 2199";
  return null;
}

const notesSchema = z
  .string()
  .max(ACTIVITY_NOTES_MAX, `Notes can be at most ${ACTIVITY_NOTES_MAX} characters`)
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  });

// ---------------------------------------------------------------------------
// Server-side input (what Server Actions accept and re-validate)
// ---------------------------------------------------------------------------

const activityFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title")
    .max(ACTIVITY_TITLE_MAX, `Keep the title under ${ACTIVITY_TITLE_MAX} characters`),
  categoryId: z.uuid("Choose a category"),
  startAt: z.iso.datetime({ offset: true, error: "Invalid start time" }),
  endAt: z.iso.datetime({ offset: true, error: "Invalid end time" }),
  status: z.enum(ACTIVITY_STATUSES),
  notes: z.union([notesSchema, z.null()]),
});

function refineTimes(value: { startAt: string; endAt: string }, ctx: z.RefinementCtx) {
  const problem = activityTimeError(Date.parse(value.startAt), Date.parse(value.endAt));
  if (problem) ctx.addIssue({ code: "custom", path: ["endAt"], message: problem });
}

export const createActivityInputSchema = activityFieldsSchema
  .extend({
    /** Client-generated id: retries of the same submission cannot create duplicates. */
    id: z.uuid(),
    /** The user confirmed saving despite overlapping activities. */
    allowOverlap: z.boolean(),
  })
  .superRefine(refineTimes);

export const updateActivityInputSchema = activityFieldsSchema
  .extend({
    id: z.uuid(),
    /** updated_at the client last saw; the update fails if someone changed it since. */
    expectedUpdatedAt: z.string().min(1),
    allowOverlap: z.boolean(),
  })
  .superRefine(refineTimes);

export type CreateActivityInput = z.input<typeof createActivityInputSchema>;
export type UpdateActivityInput = z.input<typeof updateActivityInputSchema>;

// ---------------------------------------------------------------------------
// Form schema (browser): local date + time fields in the profile time zone
// ---------------------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const activityFormFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title")
    .max(ACTIVITY_TITLE_MAX, `Keep the title under ${ACTIVITY_TITLE_MAX} characters`),
  categoryId: z.string().min(1, "Choose a category").pipe(z.uuid("Choose a category")),
  startDate: z.string().refine(isValidLocalDate, "Enter a valid start date"),
  startTime: z.string().regex(TIME_RE, "Enter a valid start time"),
  endDate: z.string().refine(isValidLocalDate, "Enter a valid end date"),
  endTime: z.string().regex(TIME_RE, "Enter a valid end time"),
  status: z.enum(ACTIVITY_STATUSES),
  notes: notesSchema,
});

export type ActivityFormValues = z.input<typeof activityFormFieldsSchema>;

export type ActivityFormOutput = {
  title: string;
  categoryId: string;
  startAt: string;
  endAt: string;
  startMs: number;
  endMs: number;
  status: (typeof ACTIVITY_STATUSES)[number];
  notes: string | null;
};

/**
 * Builds the form schema for a time zone. Its output converts the wall-clock fields into
 * absolute ISO instants, ready for the Server Action.
 */
export function activityFormSchema(timeZone: string) {
  return activityFormFieldsSchema.transform((value, ctx): ActivityFormOutput => {
    const startMs = zonedTimeToInstant(value.startDate, parseTimeOfDay(value.startTime) ?? 0, timeZone);
    const endMs = zonedTimeToInstant(value.endDate, parseTimeOfDay(value.endTime) ?? 0, timeZone);
    const problem = activityTimeError(startMs, endMs);
    if (problem) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: problem });
      return z.NEVER;
    }
    return {
      title: value.title,
      categoryId: value.categoryId,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      startMs,
      endMs,
      status: value.status,
      notes: value.notes,
    };
  });
}
