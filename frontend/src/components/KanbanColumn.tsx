import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
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
  onRename,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onOpenCard,
}: KanbanColumnProps) => {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column" },
  });
  const setRefs = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [localTitle, setLocalTitle] = useState(column.title);
  const committedTitle = useRef(column.title);

  useEffect(() => {
    setLocalTitle(column.title);
    committedTitle.current = column.title;
  }, [column.title]);

  const commitRename = () => {
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== committedTitle.current) {
      committedTitle.current = trimmed;
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
      ref={setRefs}
      style={style}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 shadow-[0_8px_20px_rgba(3,33,71,0.06)] transition",
        isOver && "border-[var(--accent-yellow)] ring-2 ring-[var(--accent-yellow)]/40",
        isDragging && "opacity-60"
      )}
      data-testid={`column-${column.id}`}
    >
      <header className="group flex items-center gap-2 px-1 pb-3">
        <button
          type="button"
          aria-label={`Reorder ${column.title}`}
          className="inline-flex h-6 w-5 items-center justify-center rounded text-[var(--gray-text)] opacity-0 transition hover:text-[var(--navy-dark)] focus:opacity-100 group-hover:opacity-100"
          {...attributes}
          {...listeners}
          // Prevent the column-drag handle from triggering text-cursor on the title input
          onClick={(e) => e.preventDefault()}
        >
          <GripIcon width={14} height={14} />
        </button>
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-yellow)]" />
        <input
          value={localTitle}
          onChange={(event) => setLocalTitle(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 flex-1 bg-transparent font-display text-[15px] font-semibold text-[var(--navy-dark)] outline-none focus:text-[var(--primary-blue)]"
          aria-label="Column title"
        />
        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--surface)] px-2 text-[11px] font-semibold text-[var(--gray-text)]">
          {cards.length}
        </span>
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
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
