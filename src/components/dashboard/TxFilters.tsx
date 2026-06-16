"use client";

import type { DatePreset } from "@/hooks/useDateFilter";

const PRESETS: { key: Exclude<DatePreset, "custom">; label: string }[] = [
  { key: "day",   label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year" },
];

interface Props {
  searchQuery: string;
  onSearch: (q: string) => void;
  activePreset: DatePreset;
  customStart: string;
  customEnd: string;
  onPreset: (p: Exclude<DatePreset, "custom">) => void;
  onCustomToggle: () => void;
  onCustomStart: (v: string) => void;
  onCustomEnd: (v: string) => void;
}

export function TxFilters({ searchQuery, onSearch, activePreset, customStart, customEnd, onPreset, onCustomToggle, onCustomStart, onCustomEnd }: Props) {
  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by description, tag, or amount..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-10 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        {searchQuery && (
          <button type="button" onClick={() => onSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-500 hover:text-zinc-200 transition" aria-label="Clear search">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => onPreset(p.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activePreset === p.key ? "bg-emerald-500 text-white" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}
          >{p.label}</button>
        ))}
        <button type="button" onClick={onCustomToggle}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activePreset === "custom" ? "bg-emerald-500 text-white" : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}
        >Custom</button>
        {activePreset === "custom" && (
          <>
            <input type="date" value={customStart} onChange={(e) => onCustomStart(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-emerald-500 [color-scheme:dark]" />
            <span className="text-xs text-zinc-600">to</span>
            <input type="date" value={customEnd} onChange={(e) => onCustomEnd(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-emerald-500 [color-scheme:dark]" />
          </>
        )}
      </div>
    </div>
  );
}
