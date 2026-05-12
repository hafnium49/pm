import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { TrashIcon } from "@/components/icons";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_8px_18px_rgba(3,33,71,0.06)]",
        "transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[0_12px_24px_rgba(3,33,71,0.10)]",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <h4 className="pr-7 font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
        {card.title}
      </h4>
      {card.details && (
        <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--gray-text)]">
          {card.details}
        </p>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(card.id);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 group-hover:opacity-100"
        aria-label={`Delete ${card.title}`}
        title="Delete card"
      >
        <TrashIcon />
      </button>
    </article>
  );
};
