import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";
import { CURRENCIES } from "@/lib/money";
import { CALENDAR_VIEWS } from "@/lib/types";

/** Mirrors the profiles.timezone CHECK constraint. */
const TIMEZONE_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/;

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .max(80, "Keep the name under 80 characters")
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }),
  currency: z.enum(CURRENCIES),
  timezone: z
    .string()
    .refine((value) => TIMEZONE_SHAPE.test(value) && isValidTimeZone(value), "Choose a valid time zone"),
  defaultCalendarView: z.enum(CALENDAR_VIEWS),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
});

export type ProfileFormValues = z.input<typeof profileFormSchema>;
export type ProfileInput = z.output<typeof profileFormSchema>;
