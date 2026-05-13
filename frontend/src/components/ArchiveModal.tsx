"use client";

import { useEffect } from "react";
import clsx from "clsx";
import type { ArchivedCard } from "@/lib/api";
import {
  ArchiveIcon,
  CloseIcon,
  RestoreIcon,
  TrashIcon,
} from "@/components/icons";
import { LABEL_CHIP_CLASS } from "@/components/labelColors";

type Props = {
  open: boolean;
  cards: ArchivedCard[];
  loading: boolean;
  onClose: () => void;
  onRestore: (cardId: string) => Promise<void>;
  onPurge: (cardId: string) => Promise<void>;
};

function formatArchivedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ArchiveModal = ({
  open,
  cards,
  loading,
  onClose,
  onRestore,
  onPurge,
}: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePurge = (card: ArchivedCard) => {
    if (!confirm(`Permanently delete "${card.title}"? This cannot be undone.`)) return;
    void onPurge(card.id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Archived cards"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.45)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-5 py-3">
          <div className="inline-flex items-center gap-2 text-[var(--navy-dark)]">
            <ArchiveIcon className="text-[var(--gray-text)]" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]">
              Archive
            </h2>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--gray-text)]">
              {cards.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close archive"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-center text-sm text-[var(--gray-text)]">Loading…</p>
          ) : cards.length === 0 ? (
            <p
              data-testid="archive-empty"
              className="text-center text-sm text-[var(--gray-text)]"
            >
              No archived cards. Cards you delete will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <li
                  key={card.id}
                  data-testid={`archived-card-${card.id}`}
                  className="group rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 transition hover:shadow-[0_8px_18px_rgba(3,33,71,0.06)]"
                >
                  <div className="flex items-start gap-3">
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
                      <h4 className="font-display text-[14px] font-semibold leading-snug text-[var(--navy-dark)]">
                        {card.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--gray-text)]">
                        From {card.column_title} · archived {formatArchivedAt(card.archived_at)}
                      </p>
                      {card.details && (
                        <p className="mt-1 line-clamp-2 text-[12px] text-[var(--gray-text)]">
                          {card.details}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Restore ${card.title}`}
                        onClick={() => void onRestore(card.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
                        title="Restore card"
                      >
                        <RestoreIcon width={14} height={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Permanently delete ${card.title}`}
                        onClick={() => handlePurge(card)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600"
                        title="Delete forever"
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
