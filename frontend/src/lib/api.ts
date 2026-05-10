import type { BoardData, Card } from "@/lib/kanban";

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
