"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import type { Label, LabelColor } from "@/lib/kanban";
import { LABEL_COLORS } from "@/lib/kanban";
import { LABEL_CHIP_CLASS, LABEL_SWATCH_CLASS } from "@/components/labelColors";
import {
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  boardLabels: Label[];
  selectedIds: Set<string>;
  onToggle: (labelId: string) => Promise<void>;
  onCreate: (name: string, color: LabelColor) => Promise<Label | null>;
  onRename: (labelId: string, name: string, color: LabelColor) => Promise<void>;
  onDelete: (labelId: string) => Promise<void>;
};

export const LabelPicker = ({
  boardLabels,
  selectedIds,
  onToggle,
  onCreate,
  onRename,
  onDelete,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<LabelColor>("slate");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<LabelColor>("slate");
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await onCreate(name, newColor);
      if (created) {
        await onToggle(created.id);
        setNewName("");
        setNewColor("slate");
        setCreating(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent, id: string) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onRename(id, editName.trim(), editColor);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (label: Label) => {
    if (busy) return;
    if (!confirm(`Delete label "${label.name}"? It will be removed from all cards.`)) return;
    setBusy(true);
    try {
      await onDelete(label.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Manage labels"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
      >
        <PlusIcon width={12} height={12} />
        {selectedIds.size > 0 ? `${selectedIds.size} labels` : "Add labels"}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Label picker"
          className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--stroke)] bg-white shadow-[0_18px_40px_rgba(3,33,71,0.16)]"
        >
          <header className="flex items-center justify-between border-b border-[var(--stroke)] px-3 py-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Labels
            </h3>
            <button
              type="button"
              aria-label="Close labels"
              onClick={() => setOpen(false)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
            >
              <CloseIcon width={12} height={12} />
            </button>
          </header>

          <ul className="max-h-64 overflow-y-auto py-1">
            {boardLabels.length === 0 && !creating && (
              <li className="px-3 py-3 text-center text-[12px] text-[var(--gray-text)]">
                No labels yet. Create one below.
              </li>
            )}
            {boardLabels.map((label) => {
              const isOn = selectedIds.has(label.id);
              const isEditing = editingId === label.id;
              return (
                <li key={label.id} className="group relative">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleEditSubmit(e, label.id)}
                      className="space-y-2 px-3 py-2"
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="w-full rounded-md border border-[var(--stroke)] px-2 py-1 text-sm outline-none focus:border-[var(--primary-blue)]"
                      />
                      <ColorSwatches value={editColor} onChange={setEditColor} />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          aria-label="Save label"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white hover:brightness-110"
                        >
                          <CheckIcon width={13} height={13} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isOn}
                        aria-label={`Toggle ${label.name}`}
                        onClick={() => onToggle(label.id)}
                        className={clsx(
                          "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition",
                          isOn ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                        )}
                      >
                        <span
                          className={clsx(
                            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            LABEL_CHIP_CLASS[label.color]
                          )}
                        >
                          {label.name}
                        </span>
                        <span className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded-sm border border-[var(--stroke)] bg-white">
                          {isOn && <CheckIcon width={11} height={11} className="text-[var(--primary-blue)]" />}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${label.name}`}
                        onClick={() => {
                          setEditingId(label.id);
                          setEditName(label.name);
                          setEditColor(label.color);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 hover:bg-[var(--surface)] hover:text-[var(--navy-dark)] focus:opacity-100 group-hover:opacity-100"
                      >
                        <PencilIcon width={12} height={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${label.name}`}
                        onClick={() => handleDelete(label)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                      >
                        <TrashIcon width={12} height={12} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="border-t border-[var(--stroke)] p-2">
            {creating ? (
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Label name"
                  autoFocus
                  className="w-full rounded-md border border-[var(--stroke)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary-blue)]"
                />
                <ColorSwatches value={newColor} onChange={setNewColor} />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim() || busy}
                    className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary-blue)] hover:bg-[var(--surface)]"
              >
                <PlusIcon width={12} height={12} />
                New label
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ColorSwatches = ({
  value,
  onChange,
}: {
  value: LabelColor;
  onChange: (c: LabelColor) => void;
}) => (
  <div role="radiogroup" aria-label="Label color" className="flex flex-wrap gap-1">
    {LABEL_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        role="radio"
        aria-checked={value === c}
        aria-label={`Color ${c}`}
        onClick={() => onChange(c)}
        className={clsx(
          "inline-flex h-6 w-6 items-center justify-center rounded-full transition",
          LABEL_SWATCH_CLASS[c],
          value === c ? "ring-2 ring-offset-1 ring-[var(--navy-dark)]" : "opacity-80 hover:opacity-100"
        )}
      >
        {value === c && <CheckIcon width={12} height={12} className="text-white" />}
      </button>
    ))}
  </div>
);
