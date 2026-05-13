import { useState } from "react";
import clsx from "clsx";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";
import { GripIcon, TrashIcon } from "@/components/icons";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  canDelete: boolean;
  readOnly?: boolean;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onOpenCard: (cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  canDelete,
  readOnly = false,
  onRename,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onOpenCard,
}: KanbanColumnProps) => {
  // The column is both a droppable target for cards AND a sortable item among columns.
  // `useSortable` registers an underlying droppable with the same id, so cards can still
  // drop here (existing handleDragEnd treats over.id == column.id as "drop in this column").
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Sync the local draft when the prop title changes (e.g. AI rename) using
  // the "derived state from props" pattern: compare prop to last-seen value
  // during render and call setState to invalidate the stale draft.
  const [localTitle, setLocalTitle] = useState(column.title);
  const [lastSyncedTitle, setLastSyncedTitle] = useState(column.title);
  if (lastSyncedTitle !== column.title) {
    setLastSyncedTitle(column.title);
    setLocalTitle(column.title);
  }

  const commitRename = () => {
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== column.title) {
      onRename(column.id, trimmed);
    }
  };

  const handleDeleteColumn = () => {
    if (!canDelete) return;
    if (!confirm(`Delete column "${column.title}"? This will remove all of its cards.`)) return;
    onDeleteColumn(column.id);
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 shadow-[0_8px_20px_rgba(3,33,71,0.06)] transition",
        isOver && !isDragging && "border-[var(--accent-yellow)] ring-2 ring-[var(--accent-yellow)]/40",
        isDragging && "opacity-60"
      )}
      data-testid={`column-${column.id}`}
    >
      <header className="group flex items-center gap-2 px-1 pb-3">
        {!readOnly && (
          <button
            type="button"
            aria-label={`Reorder ${column.title}`}
            className="inline-flex h-6 w-5 items-center justify-center rounded text-[var(--gray-text)] opacity-0 transition hover:text-[var(--navy-dark)] focus:opacity-100 group-hover:opacity-100"
            {...attributes}
            {...listeners}
          >
            <GripIcon width={14} height={14} />
          </button>
        )}
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-yellow)]" />
        <input
          value={localTitle}
          onChange={(event) => setLocalTitle(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          readOnly={readOnly}
          className="min-w-0 flex-1 bg-transparent font-display text-[15px] font-semibold text-[var(--navy-dark)] outline-none focus:text-[var(--primary-blue)]"
          aria-label="Column title"
        />
        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--surface)] px-2 text-[11px] font-semibold text-[var(--gray-text)]">
          {cards.length}
        </span>
        {!readOnly && (
          <button
            type="button"
            aria-label={`Delete column ${column.title}`}
            onClick={handleDeleteColumn}
            disabled={!canDelete}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-0 group-hover:opacity-100 disabled:group-hover:opacity-20"
            title={canDelete ? "Delete column" : "A board must have at least one column"}
          >
            <TrashIcon width={12} height={12} />
          </button>
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onOpen={onOpenCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-3 py-8 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)]/70">
            Drop a card here
          </div>
        )}
      </div>
      {!readOnly && (
        <NewCardForm
          onAdd={(title, details) => onAddCard(column.id, title, details)}
        />
      )}
    </section>
  );
};
