"use client";

import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidLocalDate, type LocalDate } from "@/lib/dates";
import { RANGE_LABELS, RANGE_PRESETS, type RangePreset } from "./list-filters";

type RangePickerProps = {
  idPrefix: string;
  preset: RangePreset;
  from: LocalDate;
  to: LocalDate;
  onChange: (next: { preset: RangePreset; from?: LocalDate; to?: LocalDate }) => void;
  presets?: readonly RangePreset[];
};

/** Date range preset select with custom from/to inputs. */
export function RangePicker({ idPrefix, preset, from, to, onChange, presets = RANGE_PRESETS }: RangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-range`}>Period</Label>
        <Select
          id={`${idPrefix}-range`}
          value={preset}
          onChange={(event) => onChange({ preset: event.target.value as RangePreset, from, to })}
          className="w-40"
        >
          {presets.map((option) => (
            <option key={option} value={option}>
              {RANGE_LABELS[option]}
            </option>
          ))}
        </Select>
      </div>
      {preset === "custom" ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-from`}>From</Label>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              value={from}
              onChange={(event) =>
                isValidLocalDate(event.target.value) && onChange({ preset, from: event.target.value, to })
              }
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-to`}>To</Label>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              value={to}
              onChange={(event) =>
                isValidLocalDate(event.target.value) && onChange({ preset, from, to: event.target.value })
              }
              className="w-40"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
