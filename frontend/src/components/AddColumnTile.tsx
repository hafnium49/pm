"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/icons";

type Props = {
  onAdd: (title: string) => Promise<void>;
};

export const AddColumnTile = ({ onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAdd(t);
      setTitle("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="add-column-button"
        className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
      >
        <span className="inline-flex items-center gap-1.5">
          <PlusIcon width={14} height={14} />
          New column
        </span>
      </button>
    );
  }

  return (
    <div
      data-testid="add-column-form"
      className="flex flex-col gap-2 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 shadow-[0_8px_20px_rgba(3,33,71,0.06)]"
    >
      <label htmlFor="new-column-title" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)]">
        Column name
      </label>
      <input
        id="new-column-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        autoFocus
        placeholder="e.g. Blocked"
        className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
      />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || busy}
          className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
};
