export type Priority = "low" | "medium" | "high";

export type LabelColor =
  | "slate"
  | "red"
  | "amber"
  | "lime"
  | "emerald"
  | "cyan"
  | "blue"
  | "violet"
  | "fuchsia"
  | "pink";

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
};

export const LABEL_COLORS: LabelColor[] = [
  "slate", "red", "amber", "lime", "emerald", "cyan", "blue", "violet", "fuchsia", "pink",
];

export type Card = {
  id: string;
  title: string;
  details: string;
  priority?: Priority;
  due_date?: string | null;
  labels?: Label[];
  comment_count?: number;
  checklist_total?: number;
  checklist_done?: number;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  position: number;
};

export type Comment = {
  id: string;
  body: string;
  author_id: string;
  author_username: string;
  created_at: string;
};

export type BoardRole = "owner" | "editor" | "viewer";

export type Member = {
  user_id: string;
  username: string;
  role: BoardRole;
  is_owner: boolean;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) return id;
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string,
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);
  if (!activeColumnId || !overColumnId) return columns;

  const activeColumn = columns.find((c) => c.id === activeColumnId);
  const overColumn = columns.find((c) => c.id === overColumnId);
  if (!activeColumn || !overColumn) return columns;

  const isOverColumn = isColumnId(columns, overId);

  // Same-column reorder (or drop on own column header → append).
  if (activeColumnId === overColumnId) {
    const withoutActive = activeColumn.cardIds.filter((id) => id !== activeId);
    let nextCardIds: string[];
    if (isOverColumn) {
      nextCardIds = [...withoutActive, activeId];
    } else {
      const oldIndex = activeColumn.cardIds.indexOf(activeId);
      const newIndex = activeColumn.cardIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return columns;
      nextCardIds = [...activeColumn.cardIds];
      nextCardIds.splice(oldIndex, 1);
      nextCardIds.splice(newIndex, 0, activeId);
    }
    return columns.map((c) =>
      c.id === activeColumnId ? { ...c, cardIds: nextCardIds } : c,
    );
  }

  // Cross-column move.
  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) return columns;

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    nextOverCardIds.splice(overIndex === -1 ? nextOverCardIds.length : overIndex, 0, activeId);
  }

  return columns.map((c) => {
    if (c.id === activeColumnId) return { ...c, cardIds: nextActiveCardIds };
    if (c.id === overColumnId) return { ...c, cardIds: nextOverCardIds };
    return c;
  });
};
