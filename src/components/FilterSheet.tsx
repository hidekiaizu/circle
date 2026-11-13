"use client";

import { useId } from "react";
import PanelSheet from "./PanelSheet";
import {
  activeFilterCount,
  attributeOptions,
  CLOSENESS_OPTIONS,
  EMPTY_FILTERS,
  type ColorBy,
  type GraphFilters,
} from "@/lib/selectors";
import type { Person } from "@/lib/types";

interface FilterSheetProps {
  people: Person[];
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  colorBy: ColorBy;
  onColorByChange: (colorBy: ColorBy) => void;
  onClose: () => void;
}

/**
 * Exploration filters and display settings. A bottom sheet on phones and a
 * popover over the top right of the graph at lg.
 */
export default function FilterSheet({
  people,
  filters,
  onFiltersChange,
  colorBy,
  onColorByChange,
  onClose,
}: FilterSheetProps) {
  const titleId = useId();
  const closenessName = useId();
  const count = activeFilterCount(filters);
  const update = (patch: Partial<GraphFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  return (
    <PanelSheet
      labelledBy={titleId}
      onClose={onClose}
      desktop="popover"
      mobileHeight="max-h-[85dvh]"
      contentClassName="px-5 py-4"
      title={
        <h2 id={titleId} className="text-lg font-semibold">
          Filters{count > 0 ? ` · ${count}` : ""}
        </h2>
      }
      footer={
        <div className="flex gap-2">
          <button
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
            disabled={
              count === 0 && filters.minCategory === EMPTY_FILTERS.minCategory
            }
            className="min-h-11 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
          >
            Clear filters
          </button>
          <button
            onClick={onClose}
            className="min-h-11 flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 lg:min-h-0"
          >
            Done
          </button>
        </div>
      }
    >
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          People
        </h3>
        <FilterSelect
          label="Major"
          value={filters.major}
          options={attributeOptions(people, "major")}
          onChange={(major) => update({ major })}
        />
        <FilterSelect
          label="Year"
          value={filters.year}
          options={attributeOptions(people, "year")}
          onChange={(year) => update({ year })}
        />
        <FilterSelect
          label="Residence"
          value={filters.residence}
          options={attributeOptions(people, "residence")}
          onChange={(residence) => update({ residence })}
        />
      </section>

      <fieldset className="mt-6">
        <legend className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Connections
        </legend>
        <div className="mt-2 space-y-1">
          {CLOSENESS_OPTIONS.map((option) => {
            const checked = filters.minCategory === option.value;
            return (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition lg:min-h-9 ${
                  checked
                    ? "bg-indigo-500/20 text-white"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <input
                  type="radio"
                  name={closenessName}
                  value={option.value}
                  checked={checked}
                  onChange={() => update({ minCategory: option.value })}
                  className="h-4 w-4 accent-indigo-500"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <section className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Display
        </h3>
        <label className="mt-3 block text-sm text-slate-300">
          Color by
          <select
            value={colorBy}
            onChange={(event) => onColorByChange(event.target.value as ColorBy)}
            className="mt-1 min-h-11 w-full rounded-lg bg-white/10 px-3 text-base text-slate-200 lg:min-h-9 lg:text-sm"
          >
            <option value="major">Major</option>
            <option value="year">Year</option>
            <option value="residence">Residence</option>
            <option value="claimed">Claim status</option>
          </select>
        </label>
      </section>
    </PanelSheet>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg bg-white/10 px-3 text-base text-slate-200 lg:min-h-9 lg:text-sm"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
