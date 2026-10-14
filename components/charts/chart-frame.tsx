"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type LegendItem = { label: string; color: string };

/** Legend that mirrors bar marks (rect keys). Text uses text tokens, never the series color. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

type ChartFrameProps = {
  title: string;
  description?: string;
  legend?: LegendItem[];
  /** Accessible equivalent of the chart: every value, readable without hovering. */
  table: React.ReactNode;
  /** Data is refreshing: keep the previous render, dimmed (no skeleton flash). */
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Chart wrapper: caption, legend, and a toggle to a data table view. */
export function ChartFrame({ title, description, legend, table, busy, children, className }: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={cn("grid min-w-0 gap-3", className)} aria-busy={busy}>
      <div className="flex items-start gap-3">
        <figcaption className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{title}</p>
          {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
        </figcaption>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-hud border border-line-strong px-2.5 text-xs text-fg-muted transition-colors hover:bg-panel-hover hover:text-fg"
        >
          {showTable ? <BarChart3 className="size-3.5" aria-hidden="true" /> : <Table2 className="size-3.5" aria-hidden="true" />}
          {showTable ? "Chart" : "Table"}
        </button>
      </div>
      {legend && legend.length > 1 && !showTable ? <ChartLegend items={legend} /> : null}
      <div className={cn("min-w-0 transition-opacity", busy && "opacity-60")}>{showTable ? table : children}</div>
    </figure>
  );
}

/** Compact, accessible data table used as every chart's table view. */
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<{ key: string; cells: React.ReactNode[] }>;
}) {
  return (
    <div className="max-h-72 overflow-auto rounded-hud border border-line">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-panel-raised">
          <tr>
            {columns.map((column, index) => (
              <th key={column} scope="col" className={cn("px-3 py-2 font-medium text-fg-muted", index > 0 && "text-right")}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line">
              {row.cells.map((cell, index) => (
                <td
                  key={index}
                  className={cn("px-3 py-1.5 text-fg", index > 0 && "text-right font-mono tabular-nums")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
