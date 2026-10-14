"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActionError, unwrap, type ActionResult } from "@/lib/action-result";
import { toAppError, type AppError } from "@/lib/errors";
import type { SyncedTable } from "@/lib/query-keys";

/** How long to wait for a Server Action before reporting a possible failure. */
const ACTION_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new ActionError({
            code: "network",
            message:
              "The server didn't respond in time. Your change may not have been saved; the data has been refreshed so you can check before retrying.",
          }),
        ),
      ACTION_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** User-facing error for anything a mutation can throw. */
export function describeMutationError(error: unknown): AppError {
  if (error instanceof ActionError) return error.appError;
  return toAppError(error);
}

/**
 * Wraps a Server Action in a TanStack mutation. Success is only reported after the action
 * returns the saved row (i.e. the database confirmed the write). Affected tables are
 * re-fetched afterwards - also after failures, in case a timed-out write did land.
 */
export function useActionMutation<TInput, TResult>(
  action: (input: TInput) => Promise<ActionResult<TResult>>,
  invalidates: readonly SyncedTable[],
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TInput>({
    // Fail fast when offline instead of silently queueing the write.
    networkMode: "always",
    retry: false,
    mutationFn: async (input) => unwrap(await withTimeout(action(input))),
    onSettled: () =>
      Promise.all(invalidates.map((table) => queryClient.invalidateQueries({ queryKey: [table] }))),
  });
}
