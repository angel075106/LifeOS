/**
 * Maps errors from Supabase (PostgREST, Auth), the network and validation into short,
 * user-facing messages. Internal details (SQL, constraint names, stack traces) never reach
 * the UI.
 */

export type AppErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "duplicate"
  | "in_use"
  | "invalid"
  | "network"
  | "unknown";

export type AppError = {
  code: AppErrorCode;
  message: string;
  /** Field-level validation messages keyed by form field name. */
  fieldErrors?: Record<string, string>;
};

export type ErrorContext = {
  /** Message for unique-constraint violations, e.g. "A category with this name already exists." */
  duplicate?: string;
  /** Message for restrict violations, e.g. "This category is still used by activities." */
  inUse?: string;
};

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /econnrefused/i,
  /enotfound/i,
  /etimedout/i,
  /the network connection was lost/i,
];

function readCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code !== "") return code;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return String(status);
  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return typeof error === "string" ? error : "";
}

export function isNetworkError(error: unknown): boolean {
  const message = readMessage(error);
  return NETWORK_PATTERNS.some((pattern) => pattern.test(message));
}

export function toAppError(error: unknown, context: ErrorContext = {}): AppError {
  if (isNetworkError(error)) {
    return { code: "network", message: "Can't reach the server. Check your connection and try again." };
  }

  switch (readCode(error)) {
    case "23505":
      return { code: "duplicate", message: context.duplicate ?? "That already exists." };
    case "23001":
      return { code: "in_use", message: context.inUse ?? "This item is still in use." };
    case "23503":
      return {
        code: "conflict",
        message: "A linked item is no longer available. Refresh and try again.",
      };
    case "23502":
    case "23514":
    case "22P02":
    case "22007":
    case "22008":
    case "22023":
    case "22001":
      return { code: "invalid", message: "Some values are invalid. Check the form and try again." };
    case "42501":
    case "403":
      return { code: "forbidden", message: "You don't have permission to do that." };
    case "PGRST116":
    case "P0002":
    case "404":
      return { code: "not_found", message: "This record no longer exists. It may have been deleted on another device." };
    case "PGRST301":
    case "PGRST302":
    case "PGRST303":
    case "401":
    case "session_not_found":
    case "refresh_token_not_found":
      return { code: "unauthenticated", message: "Your session has expired. Please sign in again." };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

/**
 * Server-side logging that records where and how something failed without writing user
 * data (amounts, titles, notes) to logs.
 */
export function logServerError(scope: string, error: unknown): void {
  const code = readCode(error) ?? (isNetworkError(error) ? "network" : "unknown");
  console.error(`[lifeos] ${scope} failed`, { code });
}
