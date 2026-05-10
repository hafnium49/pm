import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData } from "@/lib/kanban";

const mockBoard: BoardData = {
  columns: [
    { id: "1", title: "Backlog", cardIds: ["10"] },
    { id: "2", title: "Discovery", cardIds: [] },
    { id: "3", title: "In Progress", cardIds: [] },
    { id: "4", title: "Review", cardIds: [] },
    { id: "5", title: "Done", cardIds: [] },
  ],
  cards: {
    "10": { id: "10", title: "Existing card", details: "Some detail" },
  },
};

const mockFetchBoard = vi.fn();
const mockSendChatMessage = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchBoard: (...args: unknown[]) => mockFetchBoard(...args),
  renameColumn: vi.fn().mockResolvedValue(undefined),
  createCard: vi.fn().mockResolvedValue({ id: "99", title: "New card", details: "Notes" }),
  deleteCard: vi.fn().mockResolvedValue(undefined),
  moveCard: vi.fn().mockResolvedValue(undefined),
  sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

beforeEach(() => {
  mockFetchBoard.mockClear();
  mockFetchBoard.mockResolvedValue(mockBoard);
  mockSendChatMessage.mockClear();
  mockSendChatMessage.mockResolvedValue({ message: "Hello from AI!", board_updates: [] });
});

const getFirstColumn = async () => {
  const cols = await screen.findAllByTestId(/column-/i);
  return cols[0];
};

describe("KanbanBoard", () => {
  it("renders five columns after loading", async () => {
    render(<KanbanBoard />);
    const cols = await screen.findAllByTestId(/column-/i);
    expect(cols).toHaveLength(5);
  });

  it("shows loading state initially", () => {
    render(<KanbanBoard />);
    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds a card", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    await waitFor(() => expect(within(column).getByText("New card")).toBeInTheDocument());
  });

  it("shows error toast when fetchBoard fails", async () => {
    mockFetchBoard.mockRejectedValueOnce(new Error("network error"));
    render(<KanbanBoard />);
    expect(await screen.findByText(/could not load board/i)).toBeInTheDocument();
  });
});

describe("AI chat sidebar", () => {
  it("toggles open and closed via the AI button", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    expect(screen.queryByTestId("ai-sidebar")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    expect(screen.getByTestId("ai-sidebar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    expect(screen.queryByTestId("ai-sidebar")).not.toBeInTheDocument();
  });

  it("sends a message and shows the AI reply", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    await userEvent.type(screen.getByLabelText(/message to ai/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText("Hello from AI!")).toBeInTheDocument();
  });

  it("refreshes the board when AI returns board_updates", async () => {
    mockSendChatMessage.mockResolvedValueOnce({
      message: "Added a card.",
      board_updates: [{ id: null, column_id: "1", title: "AI card", details: "", delete: false }],
    });
    mockFetchBoard
      .mockResolvedValueOnce(mockBoard)
      .mockResolvedValueOnce(mockBoard);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    await userEvent.type(screen.getByLabelText(/message to ai/i), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText("Added a card.")).toBeInTheDocument();
    expect(mockFetchBoard).toHaveBeenCalledTimes(2);
  });
});
