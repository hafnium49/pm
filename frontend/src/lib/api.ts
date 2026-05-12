import type { BoardData, Card } from "@/lib/kanban";

export type BoardSummary = {
  id: string;
  name: string;
  column_count: number;
  card_count: number;
};

export type BoardFull = BoardData & { id: string; name: string };

// ---------- Auth ----------

export async function register(username: string, password: string): Promise<void> {
  const r = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Registration failed");
  }
}

// ---------- Boards (multi-board API) ----------

export async function listBoards(): Promise<BoardSummary[]> {
  const r = await fetch("/api/boards");
  if (!r.ok) throw new Error("Failed to list boards");
  return (await r.json()).boards as BoardSummary[];
}

export async function createBoard(name: string): Promise<BoardFull> {
  const r = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("Failed to create board");
  return r.json();
}

export async function fetchBoardById(boardId: string): Promise<BoardFull> {
  const r = await fetch(`/api/boards/${boardId}`);
  if (!r.ok) throw new Error("Failed to load board");
  return r.json();
}

export async function renameBoard(boardId: string, name: string): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("Failed to rename board");
}

export async function deleteBoard(boardId: string): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to delete board");
  }
}

export async function renameColumnOnBoard(
  boardId: string,
  colId: string,
  title: string,
): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/columns/${colId}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error("Failed to rename column");
}

export async function createCardOnBoard(
  boardId: string,
  columnId: string,
  title: string,
  details: string,
): Promise<Card> {
  const r = await fetch(`/api/boards/${boardId}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: Number(columnId), title, details }),
  });
  if (!r.ok) throw new Error("Failed to create card");
  return r.json();
}

export async function deleteCardOnBoard(
  boardId: string,
  cardId: string,
): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete card");
}

export async function moveCardOnBoard(
  boardId: string,
  cardId: string,
  columnId: string,
  position: number,
): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: Number(columnId), position }),
  });
  if (!r.ok) throw new Error("Failed to move card");
}

// ---------- Legacy single-board API (kept for back-compat) ----------

export async function fetchBoard(): Promise<BoardData> {
  const r = await fetch("/api/board");
  if (!r.ok) throw new Error("Failed to load board");
  return r.json();
}

export async function renameColumn(colId: string, title: string): Promise<void> {
  const r = await fetch(`/api/board/columns/${colId}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error("Failed to rename column");
}

export async function createCard(
  columnId: string,
  title: string,
  details: string
): Promise<Card> {
  const r = await fetch("/api/board/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: Number(columnId), title, details }),
  });
  if (!r.ok) throw new Error("Failed to create card");
  return r.json();
}

export async function deleteCard(cardId: string): Promise<void> {
  const r = await fetch(`/api/board/cards/${cardId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete card");
}

export async function moveCard(
  cardId: string,
  columnId: string,
  position: number
): Promise<void> {
  const r = await fetch(`/api/board/cards/${cardId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: Number(columnId), position }),
  });
  if (!r.ok) throw new Error("Failed to move card");
}

// ---------- AI chat ----------

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function sendChatMessage(
  messages: ChatMessage[],
  boardId?: string,
): Promise<{ message: string; board_updates: unknown[] }> {
  const body: Record<string, unknown> = { messages };
  if (boardId) body.board_id = Number(boardId);
  const r = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("AI request failed");
  return r.json();
}
