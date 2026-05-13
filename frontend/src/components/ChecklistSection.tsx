"use client";

import { useState } from "react";
import clsx from "clsx";
import type { ChecklistItem } from "@/lib/kanban";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";

type Props = {
  items: ChecklistItem[];
  readOnly?: boolean;
  onAdd: (text: string) => Promise<void>;
  onToggle: (itemId: string, done: boolean) => Promise<void>;
  onRename: (itemId: string, text: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
};

export const ChecklistSection = ({
  items,
  readOnly = false,
  onAdd,
  onToggle,
  onRename,
  onDelete,
}: Props) => {
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = async () => {
    const t = newText.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      await onAdd(t);
      setNewText("");
    } finally {
      setAdding(false);
    }
  };

  const handleRenameSubmit = async (id: string) => {
    const t = editText.trim();
    if (!t) {
      setEditingId(null);
      return;
    }
    await onRename(id, t);
    setEditingId(null);
  };

  return (
    <div data-testid="checklist-section" className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
          Checklist
        </span>
        {total > 0 && (
          <span data-testid="checklist-progress" className="text-[11px] font-semibold text-[var(--gray-text)]">
            {done} / {total} · {pct}%
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface)]">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item) => {
          const isEditing = editingId === item.id;
          return (
            <li
              key={item.id}
              data-testid={`checklist-item-${item.id}`}
              className="group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-[var(--surface)]"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={`Toggle ${item.text}`}
                disabled={readOnly}
                onClick={() => onToggle(item.id, !item.done)}
                className={clsx(
                  "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition",
                  item.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-[var(--stroke)] bg-white hover:border-[var(--primary-blue)]",
                  readOnly && "cursor-not-allowed opacity-60"
                )}
              >
                {item.done && <CheckIcon width={10} height={10} />}
              </button>
              {isEditing ? (
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => handleRenameSubmit(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleRenameSubmit(item.id);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                  className="min-w-0 flex-1 rounded-sm border border-[var(--stroke)] bg-white px-2 py-0.5 text-[13px] outline-none focus:border-[var(--primary-blue)]"
                />
              ) : (
                <p
                  className={clsx(
                    "min-w-0 flex-1 text-[13px] leading-snug",
                    item.done && "text-[var(--gray-text)] line-through"
                  )}
                >
                  {item.text}
                </p>
              )}
              {!readOnly && !isEditing && (
                <>
                  <button
                    type="button"
                    aria-label={`Edit ${item.text}`}
                    onClick={() => {
                      setEditingId(item.id);
                      setEditText(item.text);
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-white hover:text-[var(--navy-dark)] focus:opacity-100 group-hover:opacity-100"
                  >
                    <PencilIcon width={11} height={11} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.text}`}
                    onClick={() => onDelete(item.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <TrashIcon width={11} height={11} />
                  </button>
                </>
              )}
            </li>
          );
        })}
        {items.length === 0 && !readOnly && (
          <li className="rounded-lg border border-dashed border-[var(--stroke)] px-3 py-2 text-center text-[12px] text-[var(--gray-text)]">
            No subtasks yet.
          </li>
        )}
      </ul>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            aria-label="New checklist item"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a subtask…"
            maxLength={1000}
            className="flex-1 rounded-md border border-[var(--stroke)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newText.trim() || adding}
            aria-label="Add subtask"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white transition disabled:opacity-50"
          >
            <PlusIcon width={13} height={13} />
          </button>
        </div>
      )}
    </div>
  );
};
