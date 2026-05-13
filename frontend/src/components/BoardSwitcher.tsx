"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import type { BoardSummary } from "@/lib/api";
import {
  BoardIcon,
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  boards: BoardSummary[];
  currentBoardId: string | null;
  onSelect: (boardId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (boardId: string, name: string) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
};

export const BoardSwitcher = ({
  boards,
  currentBoardId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = boards.find((b) => b.id === currentBoardId) ?? boards[0];

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setRenamingId(null);
      setNewName("");
      setRenameValue("");
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setRenamingId(null);
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
      await onCreate(name);
      setNewName("");
      setCreating(false);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (e: FormEvent, boardId: string) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await onRename(boardId, name);
      setRenamingId(null);
      setRenameValue("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (boardId: string, boardName: string) => {
    if (busy) return;
    if (!confirm(`Delete board "${boardName}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await onDelete(boardId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch board"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
      >
        <BoardIcon width={14} height={14} className="text-[var(--primary-blue)]" />
        <span className="max-w-[160px] truncate">{current?.name ?? "No board"}</span>
        <ChevronDownIcon width={14} height={14} className="text-[var(--gray-text)]" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Boards"
          className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-[var(--stroke)] bg-white shadow-[0_18px_40px_rgba(3,33,71,0.16)]"
        >
          <ul className="max-h-80 overflow-y-auto py-1">
            {boards.map((b) => {
              const isCurrent = b.id === currentBoardId;
              const isRenaming = renamingId === b.id;
              return (
                <li key={b.id} className="group relative">
                  {isRenaming ? (
                    <form onSubmit={(e) => handleRename(e, b.id)} className="flex items-center gap-2 px-3 py-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="Board name"
                        className="flex-1 rounded-md border border-[var(--stroke)] px-2 py-1 text-sm outline-none focus:border-[var(--primary-blue)]"
                      />
                      <button
                        type="submit"
                        aria-label="Save name"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--primary-blue)] hover:bg-[var(--surface)]"
                      >
                        <CheckIcon width={14} height={14} />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        onClick={() => {
                          onSelect(b.id);
                          setOpen(false);
                        }}
                        className={clsx(
                          "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition",
                          isCurrent
                            ? "bg-[var(--surface)] text-[var(--navy-dark)]"
                            : "text-[var(--navy-dark)] hover:bg-[var(--surface)]"
                        )}
                      >
                        <span
                          className={clsx(
                            "h-2 w-2 shrink-0 rounded-full",
                            isCurrent ? "bg-[var(--primary-blue)]" : "bg-[var(--stroke)]"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
                        <span className="shrink-0 text-[11px] text-[var(--gray-text)]">
                          {b.card_count}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${b.name}`}
                        onClick={() => {
                          setRenamingId(b.id);
                          setRenameValue(b.name);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)] focus:opacity-100 group-hover:opacity-100"
                      >
                        <PencilIcon width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${b.name}`}
                        disabled={boards.length <= 1}
                        onClick={() => handleDelete(b.id, b.name)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-20 group-hover:opacity-100"
                      >
                        <TrashIcon width={13} height={13} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--stroke)] p-2">
            {creating ? (
              <form onSubmit={handleCreate} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Board name"
                  className="flex-1 rounded-md border border-[var(--stroke)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary-blue)]"
                />
                <button
                  type="submit"
                  disabled={!newName.trim() || busy}
                  className="rounded-full bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="rounded-full px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] hover:bg-[var(--surface)]"
              >
                <PlusIcon width={14} height={14} />
                New board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
