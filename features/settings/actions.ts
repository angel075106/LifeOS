"use server";

import type { ActionResult } from "@/lib/action-result";
import { mapProfile } from "@/lib/data/mappers";
import { ActionFailure, invalidInput, runAuthenticated } from "@/lib/server-action";
import type { Profile } from "@/lib/types";
import { profileFormSchema } from "./schema";

export async function updateProfile(raw: unknown): Promise<ActionResult<Profile>> {
  const parsed = profileFormSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated("profiles.update", async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: input.displayName,
        currency: input.currency,
        timezone: input.timezone,
        default_calendar_view: input.defaultCalendarView,
        week_starts_on: input.weekStartsOn,
      })
      .eq("id", user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionFailure({ code: "not_found", message: "Your profile could not be found. Reload the app." });
    return mapProfile(data);
  });
}
