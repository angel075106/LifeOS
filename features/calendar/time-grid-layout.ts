import type { ActivitySegment } from "./day-index";

/** Shortest height (in minutes) an activity is drawn with, so tiny entries stay clickable. */
export const MIN_VISUAL_MINUTES = 20;

export type PositionedSegment = ActivitySegment & {
  /** Zero-based column within its overlap cluster. */
  column: number;
  /** Number of columns in the cluster. */
  columns: number;
};

/**
 * Lays out one day's segments side by side where they overlap (like Google Calendar):
 * segments are grouped into clusters of transitive overlap, and each segment takes the
 * first free column in its cluster.
 */
export function layoutDaySegments(segments: readonly ActivitySegment[]): PositionedSegment[] {
  const visualEnd = (segment: ActivitySegment) =>
    Math.max(segment.endMinute, segment.startMinute + MIN_VISUAL_MINUTES);

  const sorted = [...segments].sort(
    (a, b) => a.startMinute - b.startMinute || visualEnd(b) - visualEnd(a) || a.activity.id.localeCompare(b.activity.id),
  );

  const result: PositionedSegment[] = [];
  let cluster: PositionedSegment[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster) item.columns = columnEnds.length;
    result.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const segment of sorted) {
    if (segment.startMinute >= clusterEnd && cluster.length > 0) flush();
    let column = columnEnds.findIndex((end) => end <= segment.startMinute);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(visualEnd(segment));
    } else {
      columnEnds[column] = visualEnd(segment);
    }
    cluster.push({ ...segment, column, columns: 1 });
    clusterEnd = cluster.length === 1 ? visualEnd(segment) : Math.max(clusterEnd, visualEnd(segment));
  }
  if (cluster.length > 0) flush();
  return result;
}
