import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "./action-result";
import { logServerError, toAppError, type AppError, type ErrorContext } from "./errors";
import { createClient, getServerUser, type ServerUser } from "./supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Throw inside an action to return a specific, user-facing error. */
export class ActionFailure extends Error {
  readonly appError: AppError;
  constructor(appError: AppError) {
    super(appError.message);
    this.appError = appError;
  }
}

/** Converts Zod issues into field errors keyed by the first path segment. */
export function invalidInput(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: { code: "invalid", message: "Check the highlighted fields and try again.", fieldErrors } };
}

/**
 * Runs a mutation for the signed-in user. Server Actions are public HTTP endpoints, so every
 * call re-verifies the session here; RLS then enforces ownership in the database.
 */
export async function runAuthenticated<T>(
  scope: string,
  run: (context: { supabase: ServerSupabase; user: ServerUser }) => Promise<T>,
  errorContext?: ErrorContext,
): Promise<ActionResult<T>> {
  try {
    const supabase = await createClient();
    const user = await getServerUser(supabase);
    if (!user) {
      return { ok: false, error: { code: "unauthenticated", message: "Your session has expired. Please sign in again." } };
    }
    return { ok: true, data: await run({ supabase, user }) };
  } catch (error) {
    // Let Next.js handle its own control-flow errors (redirect, notFound, dynamic bail-outs).
    unstable_rethrow(error);
    if (error instanceof ActionFailure) return { ok: false, error: error.appError };
    logServerError(scope, error);
    return { ok: false, error: toAppError(error, errorContext) };
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

export const CONFLICT_MESSAGE =
  "This record was changed on another device. Close the form to load the latest version, then try again.";
