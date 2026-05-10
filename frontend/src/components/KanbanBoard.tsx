"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { moveCard as localMoveCard, type BoardData } from "@/lib/kanban";
import * as api from "@/lib/api";

export const KanbanBoard = () => {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      const data = await api.fetchBoard();
      setBoard(data);
    } catch {
      showError("Could not load board.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const nextColumns = localMoveCard(board.columns, activeId, overId);
    const targetCol = nextColumns.find((c) => c.cardIds.includes(activeId));
    if (!targetCol) return;
    const newPosition = targetCol.cardIds.indexOf(activeId);

    const prevBoard = board;
    setBoard({ ...board, columns: nextColumns });

    api.moveCard(activeId, targetCol.id, newPosition).catch(() => {
      showError("Failed to move card.");
      setBoard(prevBoard);
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    if (!board) return;
    const prevBoard = board;
    setBoard({
      ...board,
      columns: board.columns.map((col) =>
        col.id === columnId ? { ...col, title } : col
      ),
    });
    api.renameColumn(columnId, title).catch(() => {
      showError("Failed to rename column.");
      setBoard(prevBoard);
    });
  };

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string
  ) => {
    if (!board) return;
    try {
      const card = await api.createCard(columnId, title, details);
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: { ...prev.cards, [card.id]: card },
          columns: prev.columns.map((col) =>
            col.id === columnId
              ? { ...col, cardIds: [...col.cardIds, card.id] }
              : col
          ),
        };
      });
    } catch {
      showError("Failed to add card.");
    }
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    if (!board) return;
    const prevBoard = board;
    setBoard({
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
          : col
      ),
    });
    api.deleteCard(cardId).catch(() => {
      showError("Failed to delete card.");
      setBoard(prevBoard);
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (!board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {!error && (
          <p className="text-sm text-[var(--gray-text)]">Loading board…</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {error && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 shadow-md"
        >
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
              >
                Log out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
