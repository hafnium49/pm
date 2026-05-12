import type { Card, Priority } from "@/lib/kanban";

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";

export type CardFilter = {
  text: string;
  labelIds: Set<string>;
  priorities: Set<Priority>;
  due: DueFilter;
};

export const emptyFilter: CardFilter = {
  text: "",
  labelIds: new Set(),
  priorities: new Set(),
  due: "any",
};

export const isFilterActive = (f: CardFilter): boolean =>
  f.text.trim() !== "" ||
  f.labelIds.size > 0 ||
  f.priorities.size > 0 ||
  f.due !== "any";

export const activeFilterCount = (f: CardFilter): number => {
  let n = 0;
  if (f.text.trim()) n += 1;
  if (f.labelIds.size > 0) n += 1;
  if (f.priorities.size > 0) n += 1;
  if (f.due !== "any") n += 1;
  return n;
};

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const parseDue = (iso: string): Date | null => {
  // Inputs are YYYY-MM-DD; treat them as local midnight to match the day-precision UX.
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const cardMatches = (card: Card, f: CardFilter, today: Date): boolean => {
  // Text: substring match against title + details (case-insensitive)
  const q = f.text.trim().toLowerCase();
  if (q) {
    const hay = `${card.title} ${card.details ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  // Labels: card must carry at least one of the selected labels (OR)
  if (f.labelIds.size > 0) {
    if (!card.labels?.some((l) => f.labelIds.has(l.id))) return false;
  }

  // Priority: card priority must be in the selected set
  if (f.priorities.size > 0) {
    const p = (card.priority ?? "medium") as Priority;
    if (!f.priorities.has(p)) return false;
  }

  // Due
  if (f.due !== "any") {
    if (f.due === "none") {
      if (card.due_date) return false;
    } else {
      if (!card.due_date) return false;
      const d = parseDue(card.due_date);
      if (!d) return false;
      const todayStart = startOfDay(today);
      if (f.due === "overdue") {
        if (d.getTime() >= todayStart.getTime()) return false;
      } else if (f.due === "today") {
        if (d.getTime() !== todayStart.getTime()) return false;
      } else if (f.due === "week") {
        const endOfWeek = new Date(todayStart);
        endOfWeek.setDate(todayStart.getDate() + 7);
        if (d.getTime() < todayStart.getTime() || d.getTime() > endOfWeek.getTime()) return false;
      }
    }
  }

  return true;
};
