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

export type ArchivedCard = Card & {
  archived_at: string | null;
  column_id: string;
  column_title: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

// ---------- Internal request helper ----------

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  fallbackError?: string;
  /** When true, include the server's `detail` field in the thrown error if present. */
  useServerDetail?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, fallbackError = "Request failed", useServerDetail = false } = opts;
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const r = await fetch(path, init);
  if (!r.ok) {
    if (useServerDetail) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.detail || fallbackError);
    }
    throw new Error(fallbackError);
  }
  // Some endpoints return no body (e.g. DELETE) — caller types the result.
  return r.json().catch(() => undefined as T);
}

// ---------- Auth ----------

export function register(username: string, password: string): Promise<void> {
  return request("/api/auth/register", {
    method: "POST",
    body: { username, password },
    fallbackError: "Registration failed",
    useServerDetail: true,
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request("/api/auth/change_password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
    fallbackError: "Could not change password",
    useServerDetail: true,
  });
}

export async function changeUsername(password: string, newUsername: string): Promise<string> {
  const data = await request<{ username: string }>("/api/auth/change_username", {
    method: "POST",
    body: { password, new_username: newUsername },
    fallbackError: "Could not change username",
    useServerDetail: true,
  });
  return data.username;
}

export function deleteAccount(password: string): Promise<void> {
  return request("/api/auth/account", {
    method: "DELETE",
    body: { password },
    fallbackError: "Could not delete account",
    useServerDetail: true,
  });
}

// ---------- Boards ----------

export async function listBoards(): Promise<BoardSummary[]> {
  const data = await request<{ boards: BoardSummary[] }>("/api/boards", {
    fallbackError: "Failed to list boards",
  });
  return data.boards;
}

export function createBoard(name: string): Promise<BoardFull> {
  return request("/api/boards", {
    method: "POST",
    body: { name },
    fallbackError: "Failed to create board",
  });
}

export function fetchBoardById(boardId: string): Promise<BoardFull> {
  return request(`/api/boards/${boardId}`, { fallbackError: "Failed to load board" });
}

export function renameBoard(boardId: string, name: string): Promise<void> {
  return request(`/api/boards/${boardId}/rename`, {
    method: "POST",
    body: { name },
    fallbackError: "Failed to rename board",
  });
}

export function deleteBoard(boardId: string): Promise<void> {
  return request(`/api/boards/${boardId}`, {
    method: "DELETE",
    fallbackError: "Failed to delete board",
    useServerDetail: true,
  });
}

// ---------- Columns ----------

export function renameColumnOnBoard(
  boardId: string,
  colId: string,
  title: string,
): Promise<void> {
  return request(`/api/boards/${boardId}/columns/${colId}/rename`, {
    method: "POST",
    body: { title },
    fallbackError: "Failed to rename column",
  });
}

export function addColumnOnBoard(
  boardId: string,
  title: string,
): Promise<{ id: string; title: string; cardIds: string[] }> {
  return request(`/api/boards/${boardId}/columns`, {
    method: "POST",
    body: { title },
    fallbackError: "Failed to add column",
  });
}

export function deleteColumnOnBoard(boardId: string, colId: string): Promise<void> {
  return request(`/api/boards/${boardId}/columns/${colId}`, {
    method: "DELETE",
    fallbackError: "Failed to delete column",
    useServerDetail: true,
  });
}

export function reorderColumnsOnBoard(boardId: string, columnIds: string[]): Promise<void> {
  return request(`/api/boards/${boardId}/columns/reorder`, {
    method: "POST",
    body: { column_ids: columnIds.map(Number) },
    fallbackError: "Failed to reorder columns",
  });
}

// ---------- Cards ----------

export function createCardOnBoard(
  boardId: string,
  columnId: string,
  title: string,
  details: string,
): Promise<Card> {
  return request(`/api/boards/${boardId}/cards`, {
    method: "POST",
    body: { column_id: Number(columnId), title, details },
    fallbackError: "Failed to create card",
  });
}

export function deleteCardOnBoard(boardId: string, cardId: string): Promise<void> {
  return request(`/api/boards/${boardId}/cards/${cardId}`, {
    method: "DELETE",
    fallbackError: "Failed to delete card",
  });
}

export function moveCardOnBoard(
  boardId: string,
  cardId: string,
  columnId: string,
  position: number,
): Promise<void> {
  return request(`/api/boards/${boardId}/cards/${cardId}/move`, {
    method: "POST",
    body: { column_id: Number(columnId), position },
    fallbackError: "Failed to move card",
  });
}

export function updateCardOnBoard(
  boardId: string,
  cardId: string,
  update: CardUpdate,
): Promise<Card> {
  return request(`/api/boards/${boardId}/cards/${cardId}`, {
    method: "POST",
    body: update,
    fallbackError: "Failed to update card",
  });
}

// ---------- Labels ----------

export async function listLabels(boardId: string): Promise<Label[]> {
  const data = await request<{ labels: Label[] }>(`/api/boards/${boardId}/labels`, {
    fallbackError: "Failed to load labels",
  });
  return data.labels;
}

export function createLabel(
  boardId: string,
  name: string,
  color: LabelColor,
): Promise<Label> {
  return request(`/api/boards/${boardId}/labels`, {
    method: "POST",
    body: { name, color },
    fallbackError: "Failed to create label",
    useServerDetail: true,
  });
}

export function updateLabel(
  boardId: string,
  labelId: string,
  update: { name?: string; color?: LabelColor },
): Promise<Label> {
  return request(`/api/boards/${boardId}/labels/${labelId}`, {
    method: "POST",
    body: update,
    fallbackError: "Failed to update label",
  });
}

export function deleteLabel(boardId: string, labelId: string): Promise<void> {
  return request(`/api/boards/${boardId}/labels/${labelId}`, {
    method: "DELETE",
    fallbackError: "Failed to delete label",
  });
}

export async function setCardLabels(
  boardId: string,
  cardId: string,
  labelIds: string[],
): Promise<Label[]> {
  const data = await request<{ labels: Label[] }>(
    `/api/boards/${boardId}/cards/${cardId}/labels`,
    {
      method: "POST",
      body: { label_ids: labelIds.map(Number) },
      fallbackError: "Failed to update card labels",
    },
  );
  return data.labels;
}

// ---------- Checklist ----------

export async function listChecklist(
  boardId: string,
  cardId: string,
): Promise<ChecklistItem[]> {
  const data = await request<{ items: ChecklistItem[] }>(
    `/api/boards/${boardId}/cards/${cardId}/checklist`,
    { fallbackError: "Failed to load checklist" },
  );
  return data.items;
}

export function addChecklistItem(
  boardId: string,
  cardId: string,
  text: string,
): Promise<ChecklistItem> {
  return request(`/api/boards/${boardId}/cards/${cardId}/checklist`, {
    method: "POST",
    body: { text },
    fallbackError: "Failed to add checklist item",
  });
}

export function updateChecklistItem(
  boardId: string,
  cardId: string,
  itemId: string,
  update: { text?: string; done?: boolean },
): Promise<ChecklistItem> {
  return request(`/api/boards/${boardId}/cards/${cardId}/checklist/${itemId}`, {
    method: "POST",
    body: update,
    fallbackError: "Failed to update checklist item",
  });
}

export function deleteChecklistItem(
  boardId: string,
  cardId: string,
  itemId: string,
): Promise<void> {
  return request(`/api/boards/${boardId}/cards/${cardId}/checklist/${itemId}`, {
    method: "DELETE",
    fallbackError: "Failed to delete checklist item",
  });
}

// ---------- Members ----------

export async function listMembers(boardId: string): Promise<Member[]> {
  const data = await request<{ members: Member[] }>(`/api/boards/${boardId}/members`, {
    fallbackError: "Failed to load members",
  });
  return data.members;
}

export function inviteMember(
  boardId: string,
  username: string,
  role: Exclude<BoardRole, "owner">,
): Promise<Member> {
  return request(`/api/boards/${boardId}/members`, {
    method: "POST",
    body: { username, role },
    fallbackError: "Failed to invite",
    useServerDetail: true,
  });
}

export function updateMemberRole(
  boardId: string,
  userId: string,
  role: Exclude<BoardRole, "owner">,
): Promise<Member> {
  return request(`/api/boards/${boardId}/members/${userId}`, {
    method: "POST",
    body: { role },
    fallbackError: "Failed to update role",
    useServerDetail: true,
  });
}

export function removeMember(boardId: string, userId: string): Promise<void> {
  return request(`/api/boards/${boardId}/members/${userId}`, {
    method: "DELETE",
    fallbackError: "Failed to remove member",
    useServerDetail: true,
  });
}

// ---------- Archive ----------

export async function listArchivedCards(boardId: string): Promise<ArchivedCard[]> {
  const data = await request<{ cards: ArchivedCard[] }>(`/api/boards/${boardId}/archive`, {
    fallbackError: "Failed to load archived cards",
  });
  return data.cards;
}

export function restoreCardOnBoard(boardId: string, cardId: string): Promise<Card> {
  return request(`/api/boards/${boardId}/cards/${cardId}/restore`, {
    method: "POST",
    fallbackError: "Failed to restore card",
  });
}

export function purgeArchivedCard(boardId: string, cardId: string): Promise<void> {
  return request(`/api/boards/${boardId}/archive/${cardId}`, {
    method: "DELETE",
    fallbackError: "Failed to permanently delete card",
  });
}

// ---------- Comments ----------

export async function listComments(boardId: string, cardId: string): Promise<Comment[]> {
  const data = await request<{ comments: Comment[] }>(
    `/api/boards/${boardId}/cards/${cardId}/comments`,
    { fallbackError: "Failed to load comments" },
  );
  return data.comments;
}

export function createComment(
  boardId: string,
  cardId: string,
  body: string,
): Promise<Comment> {
  return request(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: "POST",
    body: { body },
    fallbackError: "Failed to post comment",
  });
}

export function deleteComment(
  boardId: string,
  cardId: string,
  commentId: string,
): Promise<void> {
  return request(`/api/boards/${boardId}/cards/${cardId}/comments/${commentId}`, {
    method: "DELETE",
    fallbackError: "Failed to delete comment",
  });
}

// ---------- AI chat ----------

export function sendChatMessage(
  messages: ChatMessage[],
  boardId?: string,
): Promise<{ message: string; board_updates: unknown[] }> {
  const body: Record<string, unknown> = { messages };
  if (boardId) body.board_id = Number(boardId);
  return request("/api/ai/chat", {
    method: "POST",
    body,
    fallbackError: "AI request failed",
  });
}
