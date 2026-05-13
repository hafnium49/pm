import type {
  BoardData,
  BoardRole,
  Card,
  ChecklistItem,
  Comment,
  Label,
  LabelColor,
  Member,
  Priority,
} from "@/lib/kanban";

export type CardUpdate = {
  title?: string;
  details?: string;
  priority?: Priority;
  due_date?: string | null;
  clear_due_date?: boolean;
};

export type BoardSummary = {
  id: string;
  name: string;
  role: BoardRole;
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

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const r = await fetch("/api/auth/change_password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Could not change password");
  }
}

export async function changeUsername(
  password: string,
  newUsername: string,
): Promise<string> {
  const r = await fetch("/api/auth/change_username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, new_username: newUsername }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Could not change username");
  }
  return (await r.json()).username as string;
}

export async function deleteAccount(password: string): Promise<void> {
  const r = await fetch("/api/auth/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Could not delete account");
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

export async function addColumnOnBoard(
  boardId: string,
  title: string,
): Promise<{ id: string; title: string; cardIds: string[] }> {
  const r = await fetch(`/api/boards/${boardId}/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error("Failed to add column");
  return r.json();
}

export async function deleteColumnOnBoard(
  boardId: string,
  colId: string,
): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/columns/${colId}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to delete column");
  }
}

export async function reorderColumnsOnBoard(
  boardId: string,
  columnIds: string[],
): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/columns/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_ids: columnIds.map((id) => Number(id)) }),
  });
  if (!r.ok) throw new Error("Failed to reorder columns");
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

export async function updateCardOnBoard(
  boardId: string,
  cardId: string,
  update: CardUpdate,
): Promise<Card> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!r.ok) throw new Error("Failed to update card");
  return r.json();
}

// ---------- Labels ----------

export async function listLabels(boardId: string): Promise<Label[]> {
  const r = await fetch(`/api/boards/${boardId}/labels`);
  if (!r.ok) throw new Error("Failed to load labels");
  return (await r.json()).labels as Label[];
}

export async function createLabel(
  boardId: string,
  name: string,
  color: LabelColor,
): Promise<Label> {
  const r = await fetch(`/api/boards/${boardId}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to create label");
  }
  return r.json();
}

export async function updateLabel(
  boardId: string,
  labelId: string,
  update: { name?: string; color?: LabelColor },
): Promise<Label> {
  const r = await fetch(`/api/boards/${boardId}/labels/${labelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!r.ok) throw new Error("Failed to update label");
  return r.json();
}

export async function deleteLabel(boardId: string, labelId: string): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/labels/${labelId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete label");
}

export async function setCardLabels(
  boardId: string,
  cardId: string,
  labelIds: string[],
): Promise<Label[]> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label_ids: labelIds.map((id) => Number(id)) }),
  });
  if (!r.ok) throw new Error("Failed to update card labels");
  return (await r.json()).labels as Label[];
}

// ---------- Checklist ----------

export async function listChecklist(
  boardId: string,
  cardId: string,
): Promise<ChecklistItem[]> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/checklist`);
  if (!r.ok) throw new Error("Failed to load checklist");
  return (await r.json()).items as ChecklistItem[];
}

export async function addChecklistItem(
  boardId: string,
  cardId: string,
  text: string,
): Promise<ChecklistItem> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error("Failed to add checklist item");
  return r.json();
}

export async function updateChecklistItem(
  boardId: string,
  cardId: string,
  itemId: string,
  update: { text?: string; done?: boolean },
): Promise<ChecklistItem> {
  const r = await fetch(
    `/api/boards/${boardId}/cards/${cardId}/checklist/${itemId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    },
  );
  if (!r.ok) throw new Error("Failed to update checklist item");
  return r.json();
}

export async function deleteChecklistItem(
  boardId: string,
  cardId: string,
  itemId: string,
): Promise<void> {
  const r = await fetch(
    `/api/boards/${boardId}/cards/${cardId}/checklist/${itemId}`,
    { method: "DELETE" },
  );
  if (!r.ok) throw new Error("Failed to delete checklist item");
}

// ---------- Members ----------

export async function listMembers(boardId: string): Promise<Member[]> {
  const r = await fetch(`/api/boards/${boardId}/members`);
  if (!r.ok) throw new Error("Failed to load members");
  return (await r.json()).members as Member[];
}

export async function inviteMember(
  boardId: string,
  username: string,
  role: Exclude<BoardRole, "owner">,
): Promise<Member> {
  const r = await fetch(`/api/boards/${boardId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, role }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to invite");
  }
  return r.json();
}

export async function updateMemberRole(
  boardId: string,
  userId: string,
  role: Exclude<BoardRole, "owner">,
): Promise<Member> {
  const r = await fetch(`/api/boards/${boardId}/members/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to update role");
  }
  return r.json();
}

export async function removeMember(boardId: string, userId: string): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/members/${userId}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to remove member");
  }
}

// ---------- Archive ----------

export type ArchivedCard = Card & {
  archived_at: string | null;
  column_id: string;
  column_title: string;
};

export async function listArchivedCards(boardId: string): Promise<ArchivedCard[]> {
  const r = await fetch(`/api/boards/${boardId}/archive`);
  if (!r.ok) throw new Error("Failed to load archived cards");
  return (await r.json()).cards as ArchivedCard[];
}

export async function restoreCardOnBoard(
  boardId: string,
  cardId: string,
): Promise<Card> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/restore`, {
    method: "POST",
  });
  if (!r.ok) throw new Error("Failed to restore card");
  return r.json();
}

export async function purgeArchivedCard(
  boardId: string,
  cardId: string,
): Promise<void> {
  const r = await fetch(`/api/boards/${boardId}/archive/${cardId}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Failed to permanently delete card");
}

// ---------- Comments ----------

export async function listComments(boardId: string, cardId: string): Promise<Comment[]> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/comments`);
  if (!r.ok) throw new Error("Failed to load comments");
  return (await r.json()).comments as Comment[];
}

export async function createComment(
  boardId: string,
  cardId: string,
  body: string,
): Promise<Comment> {
  const r = await fetch(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!r.ok) throw new Error("Failed to post comment");
  return r.json();
}

export async function deleteComment(
  boardId: string,
  cardId: string,
  commentId: string,
): Promise<void> {
  const r = await fetch(
    `/api/boards/${boardId}/cards/${cardId}/comments/${commentId}`,
    { method: "DELETE" },
  );
  if (!r.ok) throw new Error("Failed to delete comment");
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
