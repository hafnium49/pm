import { describe, it, expect } from "vitest";
import {
  activeFilterCount,
  cardMatches,
  emptyFilter,
  isFilterActive,
  type CardFilter,
} from "@/lib/cardFilter";
import type { Card } from "@/lib/kanban";

const TODAY = new Date("2026-05-13T12:00:00");

const baseCard = (overrides: Partial<Card> = {}): Card => ({
  id: "1",
  title: "Untitled",
  details: "",
  priority: "medium",
  due_date: null,
  labels: [],
  ...overrides,
});

const make = (overrides: Partial<CardFilter>): CardFilter => ({
  ...emptyFilter,
  ...overrides,
});

describe("isFilterActive / activeFilterCount", () => {
  it("returns false for an empty filter", () => {
    expect(isFilterActive(emptyFilter)).toBe(false);
    expect(activeFilterCount(emptyFilter)).toBe(0);
  });

  it("counts each active facet", () => {
    const f = make({
      text: "x",
      labelIds: new Set(["1"]),
      priorities: new Set(["high"]),
      due: "today",
    });
    expect(isFilterActive(f)).toBe(true);
    expect(activeFilterCount(f)).toBe(4);
  });

  it("treats whitespace-only text as inactive", () => {
    expect(isFilterActive(make({ text: "   " }))).toBe(false);
  });
});

describe("cardMatches — text", () => {
  it("matches by title substring (case-insensitive)", () => {
    expect(cardMatches(baseCard({ title: "Plan ROADMAP" }), make({ text: "roadmap" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ title: "Plan ROADMAP" }), make({ text: "missing" }), TODAY)).toBe(false);
  });

  it("matches by details substring", () => {
    expect(cardMatches(baseCard({ details: "schedule the kickoff" }), make({ text: "kickoff" }), TODAY)).toBe(true);
  });

  it("empty text matches anything", () => {
    expect(cardMatches(baseCard(), make({ text: "" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard(), make({ text: "   " }), TODAY)).toBe(true);
  });
});

describe("cardMatches — labels", () => {
  it("matches if card has any of the selected labels", () => {
    const card = baseCard({
      labels: [
        { id: "1", name: "Bug", color: "red" },
        { id: "2", name: "P0", color: "amber" },
      ],
    });
    expect(cardMatches(card, make({ labelIds: new Set(["1"]) }), TODAY)).toBe(true);
    expect(cardMatches(card, make({ labelIds: new Set(["2", "3"]) }), TODAY)).toBe(true);
    expect(cardMatches(card, make({ labelIds: new Set(["3"]) }), TODAY)).toBe(false);
  });

  it("rejects cards with no labels when a label filter is active", () => {
    expect(cardMatches(baseCard(), make({ labelIds: new Set(["1"]) }), TODAY)).toBe(false);
  });
});

describe("cardMatches — priority", () => {
  it("matches when priority is in set", () => {
    expect(cardMatches(baseCard({ priority: "high" }), make({ priorities: new Set(["high"]) }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ priority: "low" }), make({ priorities: new Set(["high", "medium"]) }), TODAY)).toBe(false);
  });

  it("defaults missing priority to medium", () => {
    expect(cardMatches(baseCard({ priority: undefined }), make({ priorities: new Set(["medium"]) }), TODAY)).toBe(true);
  });
});

describe("cardMatches — due", () => {
  it("'none' matches cards with no due date", () => {
    expect(cardMatches(baseCard({ due_date: null }), make({ due: "none" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ due_date: "2026-05-13" }), make({ due: "none" }), TODAY)).toBe(false);
  });

  it("'overdue' matches dates strictly before today", () => {
    expect(cardMatches(baseCard({ due_date: "2026-05-12" }), make({ due: "overdue" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ due_date: "2026-05-13" }), make({ due: "overdue" }), TODAY)).toBe(false);
    expect(cardMatches(baseCard({ due_date: "2026-05-14" }), make({ due: "overdue" }), TODAY)).toBe(false);
    expect(cardMatches(baseCard({ due_date: null }), make({ due: "overdue" }), TODAY)).toBe(false);
  });

  it("'today' matches only today's date", () => {
    expect(cardMatches(baseCard({ due_date: "2026-05-13" }), make({ due: "today" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ due_date: "2026-05-14" }), make({ due: "today" }), TODAY)).toBe(false);
  });

  it("'week' matches today through 7 days out", () => {
    expect(cardMatches(baseCard({ due_date: "2026-05-13" }), make({ due: "week" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ due_date: "2026-05-20" }), make({ due: "week" }), TODAY)).toBe(true);
    expect(cardMatches(baseCard({ due_date: "2026-05-21" }), make({ due: "week" }), TODAY)).toBe(false);
    expect(cardMatches(baseCard({ due_date: "2026-05-12" }), make({ due: "week" }), TODAY)).toBe(false);
  });
});

describe("cardMatches — combined", () => {
  it("AND semantics across facets", () => {
    const card = baseCard({
      title: "Audit API",
      details: "investigate slow endpoints",
      priority: "high",
      due_date: "2026-05-13",
      labels: [{ id: "1", name: "Perf", color: "blue" }],
    });
    const both = make({
      text: "audit",
      priorities: new Set(["high"]),
      labelIds: new Set(["1"]),
      due: "today",
    });
    expect(cardMatches(card, both, TODAY)).toBe(true);
    // Flip one facet — no match
    expect(cardMatches(card, { ...both, due: "overdue" }, TODAY)).toBe(false);
    expect(cardMatches(card, { ...both, priorities: new Set(["low"]) }, TODAY)).toBe(false);
    expect(cardMatches(card, { ...both, labelIds: new Set(["999"]) }, TODAY)).toBe(false);
    expect(cardMatches(card, { ...both, text: "nope" }, TODAY)).toBe(false);
  });
});
