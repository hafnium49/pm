"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Label, Priority } from "@/lib/kanban";
import { activeFilterCount, type CardFilter, type DueFilter } from "@/lib/cardFilter";
import {
  CheckIcon,
  CloseIcon,
  FilterIcon,
  SearchIcon,
} from "@/components/icons";
import { LABEL_CHIP_CLASS } from "@/components/labelColors";

type Props = {
  filter: CardFilter;
  onChange: (next: CardFilter) => void;
  onClear: () => void;
  boardLabels: Label[];
  totalCards: number;
  matchingCards: number;
};

const PRIORITY_OPTIONS: { value: Priority; label: string; bg: string }[] = [
  { value: "low", label: "Low", bg: "bg-[var(--primary-blue)]" },
  { value: "medium", label: "Med", bg: "bg-[var(--accent-yellow)]" },
  { value: "high", label: "High", bg: "bg-red-500" },
];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "none", label: "No date" },
];

export const FilterBar = ({
  filter,
  onChange,
  onClear,
  boardLabels,
  totalCards,
  matchingCards,
}: Props) => {
  const count = activeFilterCount(filter);
  const isActive = count > 0;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const togglePriority = (p: Priority) => {
    const next = new Set(filter.priorities);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange({ ...filter, priorities: next });
  };

  const toggleLabel = (id: string) => {
    const next = new Set(filter.labelIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...filter, labelIds: next });
  };

  return (
    <div
      data-testid="filter-bar"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white/70 px-3 py-2 backdrop-blur"
    >
      <div className="relative flex min-w-[220px] flex-1 items-center">
        <span className="absolute left-3 inline-flex h-4 w-4 items-center justify-center text-[var(--gray-text)]">
          <SearchIcon width={14} height={14} />
        </span>
        <input
          aria-label="Search cards"
          placeholder="Search cards…"
          value={filter.text}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          className="w-full rounded-full border border-transparent bg-[var(--surface)] py-1.5 pl-9 pr-3 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        {filter.text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange({ ...filter, text: "" })}
            className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
          >
            <CloseIcon width={12} height={12} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Priority filter">
        {PRIORITY_OPTIONS.map((opt) => {
          const active = filter.priorities.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={active}
              aria-label={`Filter priority ${opt.value}`}
              onClick={() => togglePriority(opt.value)}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
                active
                  ? `${opt.bg} text-white shadow-sm`
                  : "border border-[var(--stroke)] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              )}
            >
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", active ? "bg-white" : opt.bg)} />
              {opt.label}
            </button>
          );
        })}
      </div>

      <select
        aria-label="Due date filter"
        value={filter.due}
        onChange={(e) => onChange({ ...filter, due: e.target.value as DueFilter })}
        className={clsx(
          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide outline-none focus:border-[var(--primary-blue)]",
          filter.due !== "any"
            ? "border-[var(--primary-blue)] bg-[var(--primary-blue)]/10 text-[var(--primary-blue)]"
            : "border-[var(--stroke)] bg-white text-[var(--gray-text)]"
        )}
      >
        {DUE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Due: {opt.label}
          </option>
        ))}
      </select>

      <div ref={moreRef} className="relative">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-label="Labels filter"
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
            filter.labelIds.size > 0
              ? "border-[var(--secondary-purple)] bg-[var(--secondary-purple)]/10 text-[var(--secondary-purple)]"
              : "border-[var(--stroke)] bg-white text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
          )}
        >
          <FilterIcon width={12} height={12} />
          Labels
          {filter.labelIds.size > 0 && (
            <span className="rounded-full bg-[var(--secondary-purple)] px-1.5 py-0.5 text-[10px] text-white">
              {filter.labelIds.size}
            </span>
          )}
        </button>
        {moreOpen && (
          <div
            role="dialog"
            aria-label="Labels filter dialog"
            className="absolute right-0 z-30 mt-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-white p-2 shadow-[0_18px_40px_rgba(3,33,71,0.16)]"
          >
            {boardLabels.length === 0 ? (
              <p className="px-3 py-2 text-center text-[12px] text-[var(--gray-text)]">
                No labels on this board.
              </p>
            ) : (
              <ul className="space-y-1">
                {boardLabels.map((label) => {
                  const on = filter.labelIds.has(label.id);
                  return (
                    <li key={label.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`Filter by ${label.name}`}
                        onClick={() => toggleLabel(label.id)}
                        className={clsx(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                          on ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                        )}
                      >
                        <span
                          className={clsx(
                            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            LABEL_CHIP_CLASS[label.color]
                          )}
                        >
                          {label.name}
                        </span>
                        <span className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded-sm border border-[var(--stroke)] bg-white">
                          {on && <CheckIcon width={11} height={11} className="text-[var(--primary-blue)]" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
        {isActive && (
          <span data-testid="filter-summary">
            {matchingCards} / {totalCards}
          </span>
        )}
        {isActive && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary-blue)] hover:underline"
          >
            Clear ({count})
          </button>
        )}
      </div>
    </div>
  );
};
