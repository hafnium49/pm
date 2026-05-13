"use client";

import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import type { Card, ChecklistItem, Comment, Label, LabelColor, Priority } from "@/lib/kanban";
import { CalendarIcon, CloseIcon, FlagIcon, TrashIcon } from "@/components/icons";
import { LabelPicker } from "@/components/LabelPicker";
import { LABEL_CHIP_CLASS } from "@/components/labelColors";
import { CommentsSection } from "@/components/CommentsSection";
import { ChecklistSection } from "@/components/ChecklistSection";

type Props = {
  card: Card;
  open: boolean;
  boardLabels: Label[];
  comments: Comment[];
  postingComment: boolean;
  currentUsername: string | null;
  checklist: ChecklistItem[];
  onAddChecklistItem: (text: string) => Promise<void>;
  onToggleChecklistItem: (itemId: string, done: boolean) => Promise<void>;
  onRenameChecklistItem: (itemId: string, text: string) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
  onSave: (update: {
    title?: string;
    details?: string;
    priority?: Priority;
    due_date?: string | null;
    clear_due_date?: boolean;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onToggleLabel: (labelId: string) => Promise<void>;
  onCreateLabel: (name: string, color: LabelColor) => Promise<Label | null>;
  onRenameLabel: (labelId: string, name: string, color: LabelColor) => Promise<void>;
  onDeleteLabel: (labelId: string) => Promise<void>;
  onPostComment: (body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const CardDetailModal = ({
  card,
  open,
  boardLabels,
  comments,
  postingComment,
  currentUsername,
  checklist,
  onAddChecklistItem,
  onToggleChecklistItem,
  onRenameChecklistItem,
  onDeleteChecklistItem,
  onSave,
  onDelete,
  onClose,
  onToggleLabel,
  onCreateLabel,
  onRenameLabel,
  onDeleteLabel,
  onPostComment,
  onDeleteComment,
}: Props) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority>(card.priority ?? "medium");
  const [dueDate, setDueDate] = useState<string>(card.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTitle(card.title);
    setDetails(card.details);
    setPriority(card.priority ?? "medium");
    setDueDate(card.due_date ?? "");
  }, [card.id, card.title, card.details, card.priority, card.due_date]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const update: Parameters<Props["onSave"]>[0] = {};
      if (title.trim() !== card.title) update.title = title.trim();
      if (details !== card.details) update.details = details;
      if (priority !== (card.priority ?? "medium")) update.priority = priority;
      const newDue = dueDate || null;
      const oldDue = card.due_date ?? null;
      if (newDue !== oldDue) {
        if (newDue === null) update.clear_due_date = true;
        else update.due_date = newDue;
      }
      if (Object.keys(update).length > 0) {
        await onSave(update);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${card.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.45)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-5 py-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Card details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="card-title" className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
              Title
            </label>
            <input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 font-display text-base font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            />
          </div>

          <div>
            <label htmlFor="card-details" className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
              Description
            </label>
            <textarea
              id="card-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              className="mt-1 w-full resize-y rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm leading-6 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            />
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
              Labels
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {(card.labels ?? []).map((label) => (
                <span
                  key={label.id}
                  data-testid={`modal-label-${label.id}`}
                  className={clsx(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    LABEL_CHIP_CLASS[label.color]
                  )}
                >
                  {label.name}
                </span>
              ))}
              <LabelPicker
                boardLabels={boardLabels}
                selectedIds={new Set((card.labels ?? []).map((l) => l.id))}
                onToggle={onToggleLabel}
                onCreate={onCreateLabel}
                onRename={onRenameLabel}
                onDelete={onDeleteLabel}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
                <FlagIcon width={12} height={12} />
                Priority
              </span>
              <div
                role="radiogroup"
                aria-label="Priority"
                className="mt-1 inline-flex rounded-full border border-[var(--stroke)] bg-[var(--surface)] p-1"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={priority === opt.value}
                    onClick={() => setPriority(opt.value)}
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      priority === opt.value
                        ? opt.value === "high"
                          ? "bg-red-500 text-white"
                          : opt.value === "low"
                          ? "bg-[var(--primary-blue)] text-white"
                          : "bg-[var(--accent-yellow)] text-[var(--navy-dark)]"
                        : "text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="card-due"
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]"
              >
                <CalendarIcon width={12} height={12} />
                Due date
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="card-due"
                  type="date"
                  aria-label="Due date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                />
                {dueDate && (
                  <button
                    type="button"
                    aria-label="Clear due date"
                    onClick={() => setDueDate("")}
                    className="text-xs text-[var(--gray-text)] hover:text-[var(--navy-dark)] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <ChecklistSection
            items={checklist}
            onAdd={onAddChecklistItem}
            onToggle={onToggleChecklistItem}
            onRename={onRenameChecklistItem}
            onDelete={onDeleteChecklistItem}
          />

          <CommentsSection
            comments={comments}
            currentUsername={currentUsername}
            posting={postingComment}
            onPost={onPostComment}
            onDelete={onDeleteComment}
          />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--stroke)] bg-[var(--surface)] px-5 py-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <TrashIcon width={13} height={13} />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};
