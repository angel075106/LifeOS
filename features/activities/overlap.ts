export type TimeRange = { startMs: number; endMs: number };

/**
 * Half-open interval overlap: [a.start, a.end) and [b.start, b.end) overlap when each starts
 * before the other ends. Back-to-back activities (one ends exactly when the next starts)
 * do not overlap.
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Items overlapping `candidate`, ignoring the candidate itself when editing. */
export function findOverlaps<T extends TimeRange & { id: string }>(
  candidate: TimeRange & { id?: string },
  items: readonly T[],
): T[] {
  return items
    .filter((item) => item.id !== candidate.id && rangesOverlap(candidate, item))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}
