"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { CardDetailModal } from "@/components/CardDetailModal";
import { AddColumnTile } from "@/components/AddColumnTile";
import {
  moveCard as localMoveCard,
  type BoardData,
  type BoardRole,
  type ChecklistItem,
  type Comment,
  type Label,
  type LabelColor,
  type Member,
} from "@/lib/kanban";
import * as api from "@/lib/api";
import type { ArchivedCard, BoardSummary, CardUpdate } from "@/lib/api";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { AccountSettingsModal } from "@/components/AccountSettingsModal";
import { ArchiveModal } from "@/components/ArchiveModal";
import { FilterBar } from "@/components/FilterBar";
import { MembersModal } from "@/components/MembersModal";
import {
  ArchiveIcon,
  LogOutIcon,
  SparkleIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import {
  cardMatches,
  emptyFilter,
  isFilterActive,
  type CardFilter,
} from "@/lib/cardFilter";

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>(emptyFilter);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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

  // Identify the current user once for ownership checks (e.g. own comments)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUsername(data.username ?? null);
        }
      } catch {
        // ignored — username is only used for UI affordances
      }
    })();
  }, []);

  // Load comments + checklist lazily when a card is opened
  useEffect(() => {
    if (!openCardId || !currentBoardId) {
      setComments([]);
      setChecklist([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [c, l] = await Promise.all([
          api.listComments(currentBoardId, openCardId),
          api.listChecklist(currentBoardId, openCardId),
        ]);
        if (!cancelled) {
          setComments(c);
          setChecklist(l);
        }
      } catch {
        if (!cancelled) showError("Could not load card details.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openCardId, currentBoardId, showError]);

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

  const handleSwitchBoard = async (boardId: string) => {
    if (boardId === currentBoardId) return;
    setCurrentBoardId(boardId);
    setFilter(emptyFilter);
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
      // Fresh board has no labels yet
      setBoardLabels([]);
      setFilter(emptyFilter);
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

    // Column reorder branch — active item is a column (data.type === "column")
    if (active.data.current?.type === "column") {
      const ids = board.columns.map((c) => c.id);
      const fromIdx = ids.indexOf(activeId);
      const toIdx = ids.indexOf(overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const nextIds = [...ids];
      const [moved] = nextIds.splice(fromIdx, 1);
      nextIds.splice(toIdx, 0, moved);
      handleReorderColumns(nextIds);
      return;
    }

    // Card move branch
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

  const refreshMembers = useCallback(async () => {
    if (!currentBoardId) return;
    setMembersLoading(true);
    try {
      const list = await api.listMembers(currentBoardId);
      setMembers(list);
      if (currentUsername) {
        const me = list.find((m) => m.username === currentUsername);
        if (me) setCurrentUserId(me.user_id);
      }
    } catch {
      showError("Could not load members.");
    } finally {
      setMembersLoading(false);
    }
  }, [currentBoardId, currentUsername, showError]);

  const handleOpenMembers = async () => {
    setMembersOpen(true);
    await refreshMembers();
  };

  const handleInviteMember = async (
    username: string,
    role: Exclude<BoardRole, "owner">,
  ) => {
    if (!currentBoardId) return;
    await api.inviteMember(currentBoardId, username, role);
    await refreshMembers();
  };

  const handleChangeMemberRole = async (
    userId: string,
    role: Exclude<BoardRole, "owner">,
  ) => {
    if (!currentBoardId) return;
    try {
      await api.updateMemberRole(currentBoardId, userId, role);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role } : m))
      );
    } catch {
      showError("Failed to change role.");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentBoardId) return;
    const isSelf = userId === currentUserId;
    const confirmMsg = isSelf
      ? "Leave this board? You won't be able to access it again unless re-invited."
      : "Remove this member?";
    if (!confirm(confirmMsg)) return;
    try {
      await api.removeMember(currentBoardId, userId);
      if (isSelf) {
        setMembersOpen(false);
        // We no longer have access — reload the boards list & switch
        const list = await refreshBoards();
        if (list.length > 0) {
          setCurrentBoardId(list[0].id);
          await loadBoard(list[0].id);
        } else {
          setBoard(null);
          setCurrentBoardId(null);
        }
      } else {
        setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to remove member.");
    }
  };

  const refreshArchive = useCallback(async () => {
    if (!currentBoardId) return [];
    setArchiveLoading(true);
    try {
      const list = await api.listArchivedCards(currentBoardId);
      setArchivedCards(list);
      return list;
    } catch {
      showError("Could not load archive.");
      return [];
    } finally {
      setArchiveLoading(false);
    }
  }, [currentBoardId, showError]);

  const handleOpenArchive = async () => {
    setArchiveOpen(true);
    await refreshArchive();
  };

  const handleRestoreFromArchive = async (cardId: string) => {
    if (!currentBoardId) return;
    try {
      await api.restoreCardOnBoard(currentBoardId, cardId);
      setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
      // Refresh the board so the card reappears in its column
      await loadBoard(currentBoardId);
      await refreshBoards();
    } catch {
      showError("Failed to restore card.");
    }
  };

  const handlePurgeFromArchive = async (cardId: string) => {
    if (!currentBoardId) return;
    try {
      await api.purgeArchivedCard(currentBoardId, cardId);
      setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch {
      showError("Failed to delete card permanently.");
    }
  };

  const handleAddColumn = async (title: string) => {
    if (!board || !currentBoardId) return;
    try {
      const created = await api.addColumnOnBoard(currentBoardId, title);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              columns: [
                ...prev.columns,
                { id: created.id, title: created.title, cardIds: created.cardIds },
              ],
            }
          : prev,
      );
      setBoards((bs) =>
        bs.map((b) =>
          b.id === currentBoardId ? { ...b, column_count: b.column_count + 1 } : b
        )
      );
    } catch {
      showError("Failed to add column.");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!board || !currentBoardId) return;
    const prevBoard = board;
    const removedCardIds = board.columns.find((c) => c.id === columnId)?.cardIds ?? [];
    setBoard({
      ...board,
      columns: board.columns.filter((c) => c.id !== columnId),
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => !removedCardIds.includes(id))
      ),
    });
    setBoards((bs) =>
      bs.map((b) =>
        b.id === currentBoardId
          ? {
              ...b,
              column_count: Math.max(0, b.column_count - 1),
              card_count: Math.max(0, b.card_count - removedCardIds.length),
            }
          : b
      )
    );
    try {
      await api.deleteColumnOnBoard(currentBoardId, columnId);
    } catch (e) {
      setBoard(prevBoard);
      showError(e instanceof Error ? e.message : "Failed to delete column.");
    }
  };

  const handleReorderColumns = async (orderedIds: string[]) => {
    if (!board || !currentBoardId) return;
    const prevBoard = board;
    const byId = new Map(board.columns.map((c) => [c.id, c]));
    const reordered = orderedIds.flatMap((id) => {
      const col = byId.get(id);
      return col ? [col] : [];
    });
    setBoard({ ...board, columns: reordered });
    try {
      await api.reorderColumnsOnBoard(currentBoardId, orderedIds);
    } catch {
      setBoard(prevBoard);
      showError("Failed to reorder columns.");
    }
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

  const bumpCommentCount = (cardId: string, delta: number) => {
    setBoard((prev) => {
      if (!prev || !prev.cards[cardId]) return prev;
      const c = prev.cards[cardId];
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...c,
            comment_count: Math.max(0, (c.comment_count ?? 0) + delta),
          },
        },
      };
    });
  };

  const handlePostComment = async (cardId: string, body: string) => {
    if (!currentBoardId) return;
    setPostingComment(true);
    try {
      const created = await api.createComment(currentBoardId, cardId, body);
      setComments((prev) => [...prev, created]);
      bumpCommentCount(cardId, 1);
    } catch {
      showError("Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  const bumpChecklistTotals = (cardId: string, deltaDone: number, deltaTotal: number) => {
    setBoard((prev) => {
      if (!prev || !prev.cards[cardId]) return prev;
      const c = prev.cards[cardId];
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...c,
            checklist_done: Math.max(0, (c.checklist_done ?? 0) + deltaDone),
            checklist_total: Math.max(0, (c.checklist_total ?? 0) + deltaTotal),
          },
        },
      };
    });
  };

  const handleAddChecklistItem = async (cardId: string, text: string) => {
    if (!currentBoardId) return;
    try {
      const item = await api.addChecklistItem(currentBoardId, cardId, text);
      setChecklist((prev) => [...prev, item]);
      bumpChecklistTotals(cardId, 0, 1);
    } catch {
      showError("Failed to add subtask.");
    }
  };

  const handleToggleChecklistItem = async (
    cardId: string,
    itemId: string,
    done: boolean,
  ) => {
    if (!currentBoardId) return;
    const prev = checklist;
    setChecklist((p) => p.map((i) => (i.id === itemId ? { ...i, done } : i)));
    bumpChecklistTotals(cardId, done ? 1 : -1, 0);
    try {
      await api.updateChecklistItem(currentBoardId, cardId, itemId, { done });
    } catch {
      setChecklist(prev);
      bumpChecklistTotals(cardId, done ? -1 : 1, 0);
      showError("Failed to toggle subtask.");
    }
  };

  const handleRenameChecklistItem = async (
    cardId: string,
    itemId: string,
    text: string,
  ) => {
    if (!currentBoardId) return;
    try {
      const updated = await api.updateChecklistItem(currentBoardId, cardId, itemId, { text });
      setChecklist((p) => p.map((i) => (i.id === itemId ? updated : i)));
    } catch {
      showError("Failed to rename subtask.");
    }
  };

  const handleDeleteChecklistItem = async (cardId: string, itemId: string) => {
    if (!currentBoardId) return;
    const removed = checklist.find((i) => i.id === itemId);
    if (!removed) return;
    const prev = checklist;
    setChecklist((p) => p.filter((i) => i.id !== itemId));
    bumpChecklistTotals(cardId, removed.done ? -1 : 0, -1);
    try {
      await api.deleteChecklistItem(currentBoardId, cardId, itemId);
    } catch {
      setChecklist(prev);
      bumpChecklistTotals(cardId, removed.done ? 1 : 0, 1);
      showError("Failed to delete subtask.");
    }
  };

  const handleDeleteComment = async (cardId: string, commentId: string) => {
    if (!currentBoardId) return;
    const prevComments = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    bumpCommentCount(cardId, -1);
    try {
      await api.deleteComment(currentBoardId, cardId, commentId);
    } catch {
      setComments(prevComments);
      bumpCommentCount(cardId, 1);
      showError("Failed to delete comment.");
    }
  };

  const handleUpdateCard = async (cardId: string, update: CardUpdate) => {
    if (!board || !currentBoardId) return;
    const prevBoard = board;
    // Optimistic local update for fields we know how to render
    const existing = board.cards[cardId];
    const optimistic = { ...existing };
    if (update.title !== undefined) optimistic.title = update.title;
    if (update.details !== undefined) optimistic.details = update.details;
    if (update.priority !== undefined) optimistic.priority = update.priority;
    if (update.clear_due_date) optimistic.due_date = null;
    else if (update.due_date !== undefined) optimistic.due_date = update.due_date;

    setBoard({ ...board, cards: { ...board.cards, [cardId]: optimistic } });
    try {
      const updated = await api.updateCardOnBoard(currentBoardId, cardId, update);
      setBoard((prev) => (prev ? { ...prev, cards: { ...prev.cards, [cardId]: updated } } : prev));
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

  const activeCard = activeCardId && board ? board.cards[activeCardId] : null;
  const totalCards = board?.columns.reduce((sum, c) => sum + c.cardIds.length, 0) ?? 0;

  let filteredColumns: ActiveBoard["columns"] = [];
  if (board) {
    if (!isFilterActive(filter)) {
      filteredColumns = board.columns;
    } else {
      const today = new Date();
      filteredColumns = board.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((cid) => {
          const c = board.cards[cid];
          return c ? cardMatches(c, filter, today) : false;
        }),
      }));
    }
  }

  const matchingCards = filteredColumns.reduce((sum, c) => sum + c.cardIds.length, 0);
  const currentRole: BoardRole =
    boards.find((b) => b.id === currentBoardId)?.role ?? "owner";
  const isWritable = currentRole === "owner" || currentRole === "editor";

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
              onClick={handleOpenMembers}
              aria-label="Open members"
              title="Board members"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--stroke)] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
            >
              <UsersIcon />
            </button>
            <button
              onClick={handleOpenArchive}
              aria-label="Open archive"
              title="Archived cards"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--stroke)] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
            >
              <ArchiveIcon />
            </button>
            <button
              onClick={() => setAccountOpen(true)}
              aria-label="Account settings"
              title={currentUsername ? `Signed in as ${currentUsername}` : "Account settings"}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 text-xs font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
            >
              <UserIcon width={14} height={14} className="text-[var(--gray-text)]" />
              <span className="max-w-[120px] truncate">
                {currentUsername ?? "Account"}
              </span>
            </button>
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
            <>
              <FilterBar
                filter={filter}
                onChange={setFilter}
                onClear={() => setFilter(emptyFilter)}
                boardLabels={boardLabels}
                totalCards={totalCards}
                matchingCards={matchingCards}
              />
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <section className="grid auto-rows-min items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <SortableContext
                    items={filteredColumns.map((c) => c.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {filteredColumns.map((column) => (
                      <KanbanColumn
                        key={column.id}
                        column={column}
                        cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                        canDelete={board.columns.length > 1 && isWritable}
                        readOnly={!isWritable}
                        onRename={handleRenameColumn}
                        onAddCard={handleAddCard}
                        onDeleteCard={handleDeleteCard}
                        onDeleteColumn={handleDeleteColumn}
                        onOpenCard={setOpenCardId}
                      />
                    ))}
                  </SortableContext>
                  {isWritable && <AddColumnTile onAdd={handleAddColumn} />}
                </section>
                <DragOverlay>
                  {activeCard ? (
                    <div className="w-[260px]">
                      <KanbanCardPreview card={activeCard} />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
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
      <MembersModal
        open={membersOpen}
        boardName={board?.name ?? ""}
        members={members}
        loading={membersLoading}
        currentRole={currentRole}
        currentUserId={currentUserId}
        onClose={() => setMembersOpen(false)}
        onInvite={handleInviteMember}
        onChangeRole={handleChangeMemberRole}
        onRemove={handleRemoveMember}
      />
      <ArchiveModal
        open={archiveOpen}
        cards={archivedCards}
        loading={archiveLoading}
        onClose={() => setArchiveOpen(false)}
        onRestore={handleRestoreFromArchive}
        onPurge={handlePurgeFromArchive}
      />
      <AccountSettingsModal
        open={accountOpen}
        currentUsername={currentUsername}
        onClose={() => setAccountOpen(false)}
        onUsernameChanged={(name) => setCurrentUsername(name)}
        onAccountDeleted={() => {
          if (typeof window !== "undefined") {
            localStorage.removeItem(CURRENT_BOARD_STORAGE_KEY);
          }
          router.replace("/login");
        }}
      />
      {openCardId && board && board.cards[openCardId] && (
        <CardDetailModal
          open
          card={board.cards[openCardId]}
          boardLabels={boardLabels}
          comments={comments}
          postingComment={postingComment}
          currentUsername={currentUsername}
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
          onPostComment={(body) => handlePostComment(openCardId, body)}
          onDeleteComment={(commentId) => handleDeleteComment(openCardId, commentId)}
          checklist={checklist}
          onAddChecklistItem={(text) => handleAddChecklistItem(openCardId, text)}
          onToggleChecklistItem={(itemId, done) =>
            handleToggleChecklistItem(openCardId, itemId, done)
          }
          onRenameChecklistItem={(itemId, text) =>
            handleRenameChecklistItem(openCardId, itemId, text)
          }
          onDeleteChecklistItem={(itemId) =>
            handleDeleteChecklistItem(openCardId, itemId)
          }
        />
      )}
    </div>
  );
};
