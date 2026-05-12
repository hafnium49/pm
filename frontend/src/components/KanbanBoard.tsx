"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
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
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { CardDetailModal } from "@/components/CardDetailModal";
import { moveCard as localMoveCard, type BoardData, type Label, type LabelColor } from "@/lib/kanban";
import * as api from "@/lib/api";
import type { BoardSummary, CardUpdate } from "@/lib/api";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { LogOutIcon, SparkleIcon } from "@/components/icons";

const CURRENT_BOARD_STORAGE_KEY = "kanban.currentBoardId";

type ActiveBoard = BoardData & { id: string; name: string };

export const KanbanBoard = () => {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [board, setBoard] = useState<ActiveBoard | null>(null);
  const [boardLabels, setBoardLabels] = useState<Label[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 4000);
  }, []);

  const refreshBoards = useCallback(async () => {
    const list = await api.listBoards();
    setBoards(list);
    return list;
  }, []);

  const loadBoard = useCallback(async (boardId: string) => {
    const [data, labels] = await Promise.all([
      api.fetchBoardById(boardId),
      api.listLabels(boardId).catch(() => []),
    ]);
    setBoard({
      id: data.id,
      name: data.name,
      columns: data.columns,
      cards: data.cards,
    });
    setBoardLabels(labels);
  }, []);

  // Initial load: get boards, pick current, load it
  useEffect(() => {
    (async () => {
      try {
        const list = await refreshBoards();
        if (list.length === 0) {
          setLoaded(true);
          return;
        }
        const stored = typeof window !== "undefined"
          ? localStorage.getItem(CURRENT_BOARD_STORAGE_KEY)
          : null;
        const chosen = (stored && list.find((b) => b.id === stored)?.id) || list[0].id;
        setCurrentBoardId(chosen);
        await loadBoard(chosen);
      } catch {
        showError("Could not load boards.");
      } finally {
        setLoaded(true);
      }
    })();
  }, [refreshBoards, loadBoard, showError]);

  // Persist current selection
  useEffect(() => {
    if (currentBoardId && typeof window !== "undefined") {
      localStorage.setItem(CURRENT_BOARD_STORAGE_KEY, currentBoardId);
    }
  }, [currentBoardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleSwitchBoard = async (boardId: string) => {
    if (boardId === currentBoardId) return;
    setCurrentBoardId(boardId);
    try {
      await loadBoard(boardId);
    } catch {
      showError("Could not load that board.");
    }
  };

  const handleCreateBoard = async (name: string) => {
    try {
      const created = await api.createBoard(name);
      await refreshBoards();
      setCurrentBoardId(created.id);
      setBoard({
        id: created.id,
        name: created.name,
        columns: created.columns,
        cards: created.cards,
      });
    } catch {
      showError("Failed to create board.");
    }
  };

  const handleRenameBoard = async (boardId: string, name: string) => {
    const prev = boards;
    setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, name } : b)));
    if (board && board.id === boardId) {
      setBoard({ ...board, name });
    }
    try {
      await api.renameBoard(boardId, name);
    } catch {
      setBoards(prev);
      if (board && board.id === boardId) {
        setBoard({ ...board, name: prev.find((b) => b.id === boardId)?.name ?? board.name });
      }
      showError("Failed to rename board.");
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await api.deleteBoard(boardId);
      const remaining = await refreshBoards();
      if (boardId === currentBoardId) {
        const next = remaining[0]?.id ?? null;
        setCurrentBoardId(next);
        if (next) {
          await loadBoard(next);
        } else {
          setBoard(null);
        }
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to delete board.");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id || !board || !currentBoardId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const nextColumns = localMoveCard(board.columns, activeId, overId);
    const targetCol = nextColumns.find((c) => c.cardIds.includes(activeId));
    if (!targetCol) return;
    const newPosition = targetCol.cardIds.indexOf(activeId);

    const prevBoard = board;
    setBoard({ ...board, columns: nextColumns });

    api.moveCardOnBoard(currentBoardId, activeId, targetCol.id, newPosition).catch(() => {
      showError("Failed to move card.");
      setBoard(prevBoard);
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    if (!board || !currentBoardId) return;
    const prevBoard = board;
    setBoard({
      ...board,
      columns: board.columns.map((col) =>
        col.id === columnId ? { ...col, title } : col
      ),
    });
    api.renameColumnOnBoard(currentBoardId, columnId, title).catch(() => {
      showError("Failed to rename column.");
      setBoard(prevBoard);
    });
  };

  const handleAddCard = async (columnId: string, title: string, details: string) => {
    if (!board || !currentBoardId) return;
    try {
      const card = await api.createCardOnBoard(currentBoardId, columnId, title, details);
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
      // Update card count summary
      setBoards((bs) =>
        bs.map((b) =>
          b.id === currentBoardId ? { ...b, card_count: b.card_count + 1 } : b
        )
      );
    } catch {
      showError("Failed to add card.");
    }
  };

  const setCardLabelsLocally = (cardId: string, labels: Label[]) => {
    setBoard((prev) => {
      if (!prev || !prev.cards[cardId]) return prev;
      return {
        ...prev,
        cards: { ...prev.cards, [cardId]: { ...prev.cards[cardId], labels } },
      };
    });
  };

  const handleToggleCardLabel = async (cardId: string, labelId: string) => {
    if (!board || !currentBoardId) return;
    const current = board.cards[cardId]?.labels ?? [];
    const isOn = current.some((l) => l.id === labelId);
    const nextIds = isOn
      ? current.filter((l) => l.id !== labelId).map((l) => l.id)
      : [...current.map((l) => l.id), labelId];
    try {
      const updated = await api.setCardLabels(currentBoardId, cardId, nextIds);
      setCardLabelsLocally(cardId, updated);
    } catch {
      showError("Failed to update card labels.");
    }
  };

  const handleCreateLabel = async (name: string, color: LabelColor): Promise<Label | null> => {
    if (!currentBoardId) return null;
    try {
      const label = await api.createLabel(currentBoardId, name, color);
      setBoardLabels((prev) => [...prev, label]);
      return label;
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to create label.");
      return null;
    }
  };

  const handleRenameLabel = async (labelId: string, name: string, color: LabelColor) => {
    if (!currentBoardId) return;
    try {
      const updated = await api.updateLabel(currentBoardId, labelId, { name, color });
      setBoardLabels((prev) => prev.map((l) => (l.id === labelId ? updated : l)));
      // Also patch any cards displaying this label
      setBoard((prev) => {
        if (!prev) return prev;
        const cards = { ...prev.cards };
        for (const id of Object.keys(cards)) {
          const c = cards[id];
          if (c.labels?.some((l) => l.id === labelId)) {
            cards[id] = {
              ...c,
              labels: c.labels.map((l) => (l.id === labelId ? updated : l)),
            };
          }
        }
        return { ...prev, cards };
      });
    } catch {
      showError("Failed to rename label.");
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!currentBoardId) return;
    try {
      await api.deleteLabel(currentBoardId, labelId);
      setBoardLabels((prev) => prev.filter((l) => l.id !== labelId));
      setBoard((prev) => {
        if (!prev) return prev;
        const cards = { ...prev.cards };
        for (const id of Object.keys(cards)) {
          const c = cards[id];
          if (c.labels?.some((l) => l.id === labelId)) {
            cards[id] = { ...c, labels: c.labels.filter((l) => l.id !== labelId) };
          }
        }
        return { ...prev, cards };
      });
    } catch {
      showError("Failed to delete label.");
    }
  };

  const handleUpdateCard = async (cardId: string, update: CardUpdate) => {
    if (!board || !currentBoardId) return;
    const prevBoard = board;
    // Optimistic local update for fields we know how to render
    setBoard({
      ...board,
      cards: {
        ...board.cards,
        [cardId]: {
          ...board.cards[cardId],
          ...(update.title !== undefined ? { title: update.title } : {}),
          ...(update.details !== undefined ? { details: update.details } : {}),
          ...(update.priority !== undefined ? { priority: update.priority } : {}),
          ...(update.clear_due_date
            ? { due_date: null }
            : update.due_date !== undefined
            ? { due_date: update.due_date }
            : {}),
        },
      },
    });
    try {
      const updated = await api.updateCardOnBoard(currentBoardId, cardId, update);
      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, cards: { ...prev.cards, [cardId]: updated } };
      });
    } catch {
      showError("Failed to update card.");
      setBoard(prevBoard);
    }
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    if (!board || !currentBoardId) return;
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
    setBoards((bs) =>
      bs.map((b) =>
        b.id === currentBoardId ? { ...b, card_count: Math.max(0, b.card_count - 1) } : b
      )
    );
    api.deleteCardOnBoard(currentBoardId, cardId).catch(() => {
      showError("Failed to delete card.");
      setBoard(prevBoard);
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_BOARD_STORAGE_KEY);
    }
    router.replace("/login");
  };

  const refreshActiveBoardAfterAI = useCallback(async () => {
    if (!currentBoardId) return;
    try {
      await loadBoard(currentBoardId);
      await refreshBoards();
    } catch {
      showError("Could not refresh after AI update.");
    }
  }, [currentBoardId, loadBoard, refreshBoards, showError]);

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const totalCards = board?.columns.reduce((sum, c) => sum + c.cardIds.length, 0) ?? 0;

  if (!loaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        {error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-[var(--gray-text)]">Loading boards…</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {error && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 shadow-md"
        >
          {error}
        </div>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute left-0 top-0 h-[360px] w-[360px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.20)_0%,_rgba(32,157,215,0.04)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.14)_0%,_rgba(117,57,145,0.04)_55%,_transparent_75%)]" />

        <header className="relative z-10 flex items-center justify-between gap-4 border-b border-[var(--stroke)] bg-white/70 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--navy-dark)]">
              Kanban Studio
            </h1>
            <BoardSwitcher
              boards={boards}
              currentBoardId={currentBoardId}
              onSelect={handleSwitchBoard}
              onCreate={handleCreateBoard}
              onRename={handleRenameBoard}
              onDelete={handleDeleteBoard}
            />
            <span className="hidden text-xs font-medium text-[var(--gray-text)] md:inline">
              {totalCards} {totalCards === 1 ? "card" : "cards"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle AI assistant"
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                sidebarOpen
                  ? "border-[var(--secondary-purple)] bg-[var(--secondary-purple)] text-white"
                  : "border-[var(--stroke)] text-[var(--secondary-purple)] hover:border-[var(--secondary-purple)]"
              )}
            >
              <SparkleIcon width={14} height={14} />
              <span className="uppercase tracking-[0.16em]">AI</span>
            </button>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--stroke)] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
              title="Log out"
            >
              <LogOutIcon />
            </button>
          </div>
        </header>

        <main className="relative z-0 flex-1 px-6 py-6">
          {board ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <section className="grid auto-rows-min items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                    onOpenCard={setOpenCardId}
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
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-[var(--gray-text)]">
                You have no boards. Create one to get started.
              </p>
              <button
                type="button"
                onClick={() => handleCreateBoard("My Board")}
                className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:brightness-110"
              >
                Create board
              </button>
            </div>
          )}
        </main>
      </div>
      {sidebarOpen && (
        <AIChatSidebar
          boardId={currentBoardId}
          onRefresh={refreshActiveBoardAfterAI}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      {openCardId && board && board.cards[openCardId] && (
        <CardDetailModal
          open
          card={board.cards[openCardId]}
          boardLabels={boardLabels}
          onSave={(update) => handleUpdateCard(openCardId, update)}
          onDelete={async () => {
            const card = board.cards[openCardId];
            const col = board.columns.find((c) => c.cardIds.includes(openCardId));
            if (col) handleDeleteCard(col.id, card.id);
          }}
          onClose={() => setOpenCardId(null)}
          onToggleLabel={(labelId) => handleToggleCardLabel(openCardId, labelId)}
          onCreateLabel={handleCreateLabel}
          onRenameLabel={handleRenameLabel}
          onDeleteLabel={handleDeleteLabel}
        />
      )}
    </div>
  );
};
