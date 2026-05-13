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

const activeFacets = (f: CardFilter): boolean[] => [
  f.text.trim() !== "",
  f.labelIds.size > 0,
  f.priorities.size > 0,
  f.due !== "any",
];

export const isFilterActive = (f: CardFilter): boolean =>
  activeFacets(f).some(Boolean);

export const activeFilterCount = (f: CardFilter): number =>
  activeFacets(f).filter(Boolean).length;

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

  if (f.due !== "any" && !dueMatches(card.due_date ?? null, f.due, today)) {
    return false;
  }

  return true;
};

function dueMatches(
  cardDue: string | null,
  filter: Exclude<DueFilter, "any">,
  today: Date,
): boolean {
  if (filter === "none") return cardDue === null;
  if (!cardDue) return false;
  const d = parseDue(cardDue);
  if (!d) return false;
  const todayStart = startOfDay(today);
  const cardTime = d.getTime();
  const todayTime = todayStart.getTime();
  switch (filter) {
    case "overdue":
      return cardTime < todayTime;
    case "today":
      return cardTime === todayTime;
    case "week": {
      const weekEnd = new Date(todayStart);
      weekEnd.setDate(todayStart.getDate() + 7);
      return cardTime >= todayTime && cardTime <= weekEnd.getTime();
    }
  }
}
