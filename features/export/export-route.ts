import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  fetchActivitiesOverlapping,
  fetchActivityCategories,
  fetchFinanceCategories,
  fetchProfile,
  fetchTransactionsBetween,
  RangeTooLargeError,
} from "@/lib/data/queries";
import { dateRangeInstants, isValidLocalDate, todayInZone } from "@/lib/dates";
import { logServerError } from "@/lib/errors";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { activitiesCsv, transactionsCsv } from "./csv-export";

const rangeSchema = z
  .object({
    from: z.string().refine(isValidLocalDate),
    to: z.string().refine(isValidLocalDate),
  })
  .refine((range) => range.from <= range.to && range.from >= "1970-01-01" && range.to <= "2199-12-31");

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

/**
 * Streams the signed-in user's records as CSV. The session is verified here (route handlers
 * are public endpoints) and every query runs under RLS with the user's own token.
 */
export async function exportCsv(request: NextRequest, kind: "transactions" | "activities"): Promise<Response> {
  // Private, per-user data: always generated at request time, never prerendered.
  await connection();
  try {
    const supabase = await createClient();
    const user = await getServerUser(supabase);
    if (!user) return jsonError(401, "Not authenticated");

    const profile = await fetchProfile(supabase, user.id);
    const timeZone = profile?.timezone ?? "UTC";
    const today = todayInZone(timeZone);
    const params = request.nextUrl.searchParams;
    const parsed = rangeSchema.safeParse({
      from: params.get("from") ?? `${today.slice(0, 4)}-01-01`,
      to: params.get("to") ?? today,
    });
    if (!parsed.success) return jsonError(400, "Invalid date range");
    const { from, to } = parsed.data;

    let csv: string;
    if (kind === "transactions") {
      const [transactions, categories] = await Promise.all([
        fetchTransactionsBetween(supabase, from, to),
        fetchFinanceCategories(supabase),
      ]);
      csv = transactionsCsv(transactions, new Map(categories.map((category) => [category.id, category])));
    } else {
      const { start, end } = dateRangeInstants(from, to, timeZone);
      const [activities, categories] = await Promise.all([
        fetchActivitiesOverlapping(supabase, start, end),
        fetchActivityCategories(supabase),
      ]);
      csv = activitiesCsv(activities, new Map(categories.map((category) => [category.id, category])), timeZone);
    }

    return new Response(csv, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lifeos-${kind}-${from}_${to}.csv"`,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof RangeTooLargeError) return jsonError(413, error.message);
    logServerError(`export.${kind}`, error);
    return jsonError(500, "Export failed. Please try again.");
  }
}
