import clsx from "clsx";
import type { Card, Priority } from "@/lib/kanban";
import { LABEL_CHIP_CLASS } from "@/components/labelColors";

type KanbanCardPreviewProps = {
  card: Card;
};

const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-[var(--primary-blue)]",
  medium: "bg-[var(--accent-yellow)]",
  high: "bg-red-500",
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => {
  const priority = (card.priority ?? "medium") as Priority;
  return (
    <article className="rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
      <div className="flex items-start gap-2">
        <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_COLOR[priority])} />
        <div className="min-w-0 flex-1">
          {card.labels && card.labels.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {card.labels.map((label) => (
                <span
                  key={label.id}
                  className={clsx(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    LABEL_CHIP_CLASS[label.color]
                  )}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
          <h4 className="font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
