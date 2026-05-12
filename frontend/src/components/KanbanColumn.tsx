import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
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

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 shadow-[0_8px_20px_rgba(3,33,71,0.06)] transition",
        isOver && "border-[var(--accent-yellow)] ring-2 ring-[var(--accent-yellow)]/40"
      )}
      data-testid={`column-${column.id}`}
    >
      <header className="flex items-center gap-2 px-1 pb-3">
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
      </header>
      <div className="flex flex-1 flex-col gap-2">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
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
