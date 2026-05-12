import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card, Priority } from "@/lib/kanban";
import { CalendarIcon, CommentIcon, TrashIcon } from "@/components/icons";
import { LABEL_CHIP_CLASS } from "@/components/labelColors";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onOpen: (cardId: string) => void;
};

const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-[var(--primary-blue)]",
  medium: "bg-[var(--accent-yellow)]",
  high: "bg-red-500",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

function dueStatus(due: string): "overdue" | "today" | "upcoming" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "upcoming";
  if (d.getTime() < today.getTime()) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  return "upcoming";
}

function formatDue(due: string) {
  const d = new Date(`${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const KanbanCard = ({ card, onDelete, onOpen }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = (card.priority ?? "medium") as Priority;
  const due = card.due_date ?? null;
  const status = due ? dueStatus(due) : null;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_8px_18px_rgba(3,33,71,0.06)]",
        "cursor-pointer transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[0_12px_24px_rgba(3,33,71,0.10)]",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      onClick={(e) => {
        // Ignore clicks that originated on buttons (delete, etc.)
        if ((e.target as HTMLElement).closest("button")) return;
        onOpen(card.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(card.id);
        }
      }}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_COLOR[priority])}
          aria-label={PRIORITY_LABEL[priority]}
          title={PRIORITY_LABEL[priority]}
        />
        <div className="min-w-0 flex-1">
          {card.labels && card.labels.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1 pr-7">
              {card.labels.map((label) => (
                <span
                  key={label.id}
                  className={clsx(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    LABEL_CHIP_CLASS[label.color]
                  )}
                  data-testid={`card-label-${label.id}`}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
          <h4 className="pr-7 font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1 line-clamp-3 text-[13px] leading-[1.5] text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
          {(due || (card.comment_count ?? 0) > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {due && (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    status === "overdue" && "bg-red-50 text-red-700",
                    status === "today" && "bg-amber-50 text-amber-700",
                    status === "upcoming" && "bg-[var(--surface)] text-[var(--gray-text)]"
                  )}
                  title={`Due ${due}${status === "overdue" ? " (overdue)" : status === "today" ? " (today)" : ""}`}
                >
                  <CalendarIcon width={11} height={11} />
                  {formatDue(due)}
                </span>
              )}
              {(card.comment_count ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gray-text)]"
                  data-testid="comment-count"
                  title={`${card.comment_count} comments`}
                >
                  <CommentIcon width={11} height={11} />
                  {card.comment_count}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
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
