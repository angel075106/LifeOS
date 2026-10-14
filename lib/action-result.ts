import type { AppError } from "./errors";

/** Serializable result returned by every Server Action. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: AppError };

/** Turns a failed ActionResult into a thrown error for TanStack Query mutations. */
export class ActionError extends Error {
  readonly appError: AppError;
  constructor(appError: AppError) {
    super(appError.message);
    this.name = "ActionError";
    this.appError = appError;
  }
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new ActionError(result.error);
  return result.data;
}
