import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardSummary, BoardFull } from "@/lib/api";

const makeBoard = (id: string, name: string, withCard = false): BoardFull => ({
  id,
  name,
  columns: [
    { id: `${id}-1`, title: "Backlog", cardIds: withCard ? [`${id}-c1`] : [] },
    { id: `${id}-2`, title: "Discovery", cardIds: [] },
    { id: `${id}-3`, title: "In Progress", cardIds: [] },
    { id: `${id}-4`, title: "Review", cardIds: [] },
    { id: `${id}-5`, title: "Done", cardIds: [] },
  ],
  cards: withCard
    ? { [`${id}-c1`]: { id: `${id}-c1`, title: "Existing card", details: "Some detail" } }
    : {},
});

const mockListBoards = vi.fn();
const mockFetchBoardById = vi.fn();
const mockCreateBoard = vi.fn();
const mockRenameBoard = vi.fn();
const mockDeleteBoard = vi.fn();
const mockCreateCardOnBoard = vi.fn();
const mockDeleteCardOnBoard = vi.fn();
const mockMoveCardOnBoard = vi.fn();
const mockUpdateCardOnBoard = vi.fn();
const mockRenameColumnOnBoard = vi.fn();
const mockSendChatMessage = vi.fn();
const mockListLabels = vi.fn();
const mockCreateLabel = vi.fn();
const mockUpdateLabel = vi.fn();
const mockDeleteLabel = vi.fn();
const mockSetCardLabels = vi.fn();
const mockListComments = vi.fn();
const mockCreateComment = vi.fn();
const mockDeleteComment = vi.fn();
const mockAddColumnOnBoard = vi.fn();
const mockDeleteColumnOnBoard = vi.fn();
const mockReorderColumnsOnBoard = vi.fn();
const mockListArchivedCards = vi.fn();
const mockRestoreCardOnBoard = vi.fn();
const mockPurgeArchivedCard = vi.fn();
const mockListChecklist = vi.fn();
const mockAddChecklistItem = vi.fn();
const mockUpdateChecklistItem = vi.fn();
const mockDeleteChecklistItem = vi.fn();
const mockListMembers = vi.fn();
const mockInviteMember = vi.fn();
const mockUpdateMemberRole = vi.fn();
const mockRemoveMember = vi.fn();

vi.mock("@/lib/api", () => ({
  listBoards: (...a: unknown[]) => mockListBoards(...a),
  fetchBoardById: (...a: unknown[]) => mockFetchBoardById(...a),
  createBoard: (...a: unknown[]) => mockCreateBoard(...a),
  renameBoard: (...a: unknown[]) => mockRenameBoard(...a),
  deleteBoard: (...a: unknown[]) => mockDeleteBoard(...a),
  createCardOnBoard: (...a: unknown[]) => mockCreateCardOnBoard(...a),
  deleteCardOnBoard: (...a: unknown[]) => mockDeleteCardOnBoard(...a),
  moveCardOnBoard: (...a: unknown[]) => mockMoveCardOnBoard(...a),
  updateCardOnBoard: (...a: unknown[]) => mockUpdateCardOnBoard(...a),
  renameColumnOnBoard: (...a: unknown[]) => mockRenameColumnOnBoard(...a),
  sendChatMessage: (...a: unknown[]) => mockSendChatMessage(...a),
  listLabels: (...a: unknown[]) => mockListLabels(...a),
  createLabel: (...a: unknown[]) => mockCreateLabel(...a),
  updateLabel: (...a: unknown[]) => mockUpdateLabel(...a),
  deleteLabel: (...a: unknown[]) => mockDeleteLabel(...a),
  setCardLabels: (...a: unknown[]) => mockSetCardLabels(...a),
  listComments: (...a: unknown[]) => mockListComments(...a),
  createComment: (...a: unknown[]) => mockCreateComment(...a),
  deleteComment: (...a: unknown[]) => mockDeleteComment(...a),
  addColumnOnBoard: (...a: unknown[]) => mockAddColumnOnBoard(...a),
  deleteColumnOnBoard: (...a: unknown[]) => mockDeleteColumnOnBoard(...a),
  reorderColumnsOnBoard: (...a: unknown[]) => mockReorderColumnsOnBoard(...a),
  listArchivedCards: (...a: unknown[]) => mockListArchivedCards(...a),
  restoreCardOnBoard: (...a: unknown[]) => mockRestoreCardOnBoard(...a),
  purgeArchivedCard: (...a: unknown[]) => mockPurgeArchivedCard(...a),
  listChecklist: (...a: unknown[]) => mockListChecklist(...a),
  addChecklistItem: (...a: unknown[]) => mockAddChecklistItem(...a),
  updateChecklistItem: (...a: unknown[]) => mockUpdateChecklistItem(...a),
  deleteChecklistItem: (...a: unknown[]) => mockDeleteChecklistItem(...a),
  listMembers: (...a: unknown[]) => mockListMembers(...a),
  inviteMember: (...a: unknown[]) => mockInviteMember(...a),
  updateMemberRole: (...a: unknown[]) => mockUpdateMemberRole(...a),
  removeMember: (...a: unknown[]) => mockRemoveMember(...a),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const SUMMARIES: BoardSummary[] = [
  { id: "1", name: "My Board", column_count: 5, card_count: 1 },
];

beforeEach(() => {
  localStorage.clear();
  mockListBoards.mockReset();
  mockFetchBoardById.mockReset();
  mockCreateBoard.mockReset();
  mockRenameBoard.mockReset();
  mockDeleteBoard.mockReset();
  mockCreateCardOnBoard.mockReset();
  mockDeleteCardOnBoard.mockReset();
  mockMoveCardOnBoard.mockReset();
  mockRenameColumnOnBoard.mockReset();
  mockSendChatMessage.mockReset();
  mockListLabels.mockReset();
  mockCreateLabel.mockReset();
  mockUpdateLabel.mockReset();
  mockDeleteLabel.mockReset();
  mockSetCardLabels.mockReset();
  mockListComments.mockReset();
  mockCreateComment.mockReset();
  mockDeleteComment.mockReset();
  mockAddColumnOnBoard.mockReset();
  mockDeleteColumnOnBoard.mockReset();
  mockReorderColumnsOnBoard.mockReset();
  mockAddColumnOnBoard.mockResolvedValue({ id: "100", title: "Blocked", cardIds: [] });
  mockDeleteColumnOnBoard.mockResolvedValue(undefined);
  mockReorderColumnsOnBoard.mockResolvedValue(undefined);
  mockListArchivedCards.mockReset();
  mockRestoreCardOnBoard.mockReset();
  mockPurgeArchivedCard.mockReset();
  mockListChecklist.mockReset();
  mockAddChecklistItem.mockReset();
  mockUpdateChecklistItem.mockReset();
  mockDeleteChecklistItem.mockReset();
  mockListMembers.mockReset();
  mockInviteMember.mockReset();
  mockUpdateMemberRole.mockReset();
  mockRemoveMember.mockReset();
  mockListChecklist.mockResolvedValue([]);
  mockAddChecklistItem.mockResolvedValue({ id: "1", text: "x", done: false, position: 0 });
  mockUpdateChecklistItem.mockResolvedValue({ id: "1", text: "x", done: true, position: 0 });
  mockDeleteChecklistItem.mockResolvedValue(undefined);
  mockListMembers.mockResolvedValue([]);
  mockListArchivedCards.mockResolvedValue([]);
  mockRestoreCardOnBoard.mockResolvedValue({ id: "1-c1" });
  mockPurgeArchivedCard.mockResolvedValue(undefined);
  mockListLabels.mockResolvedValue([]);
  mockSetCardLabels.mockResolvedValue([]);
  mockCreateLabel.mockResolvedValue({ id: "10", name: "Bug", color: "red" });
  mockListComments.mockResolvedValue([]);
  mockCreateComment.mockResolvedValue({
    id: "1",
    body: "ok",
    author_id: "1",
    author_username: "user",
    created_at: new Date().toISOString(),
  });
  mockDeleteComment.mockResolvedValue(undefined);

  mockListBoards.mockResolvedValue([...SUMMARIES]);
  mockFetchBoardById.mockResolvedValue(makeBoard("1", "My Board", true));
  mockRenameBoard.mockResolvedValue(undefined);
  mockDeleteBoard.mockResolvedValue(undefined);
  mockCreateCardOnBoard.mockResolvedValue({ id: "99", title: "New card", details: "Notes", priority: "medium", due_date: null });
  mockDeleteCardOnBoard.mockResolvedValue(undefined);
  mockMoveCardOnBoard.mockResolvedValue(undefined);
  mockUpdateCardOnBoard.mockResolvedValue({ id: "1-c1", title: "Existing card", details: "Some detail", priority: "high", due_date: "2026-12-31" });
  mockRenameColumnOnBoard.mockResolvedValue(undefined);
  mockSendChatMessage.mockResolvedValue({ message: "Hello from AI!", board_updates: [] });
});

const getFirstColumn = async () => {
  const cols = await screen.findAllByTestId(/^column-/);
  return cols[0];
};

describe("KanbanBoard", () => {
  it("renders five columns after loading", async () => {
    render(<KanbanBoard />);
    const cols = await screen.findAllByTestId(/^column-/);
    expect(cols).toHaveLength(5);
    expect(mockListBoards).toHaveBeenCalled();
    expect(mockFetchBoardById).toHaveBeenCalledWith("1");
  });

  it("shows loading state initially", () => {
    render(<KanbanBoard />);
    expect(screen.getByText(/loading boards/i)).toBeInTheDocument();
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds a card via /api/boards endpoint", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    await waitFor(() => expect(within(column).getByText("New card")).toBeInTheDocument());
    expect(mockCreateCardOnBoard).toHaveBeenCalledWith("1", "1-1", "New card", "Notes");
  });

  it("shows error toast when listBoards fails", async () => {
    mockListBoards.mockRejectedValueOnce(new Error("network error"));
    render(<KanbanBoard />);
    expect(await screen.findByText(/could not load boards/i)).toBeInTheDocument();
  });
});

describe("BoardSwitcher integration", () => {
  beforeEach(() => {
    mockListBoards.mockResolvedValue([
      { id: "1", name: "My Board", column_count: 5, card_count: 0 },
      { id: "2", name: "Project Phoenix", column_count: 5, card_count: 3 },
    ]);
  });

  it("lists boards in the dropdown", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /switch board/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("My Board")).toBeInTheDocument();
    expect(within(listbox).getByText("Project Phoenix")).toBeInTheDocument();
  });

  it("switches to another board on click", async () => {
    mockFetchBoardById
      .mockResolvedValueOnce(makeBoard("1", "My Board", true))
      .mockResolvedValueOnce(makeBoard("2", "Project Phoenix"));
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /switch board/i }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByRole("option", { name: /Project Phoenix/i }));
    await waitFor(() => expect(mockFetchBoardById).toHaveBeenLastCalledWith("2"));
  });

  it("creates a new board via the dropdown", async () => {
    mockCreateBoard.mockResolvedValueOnce(makeBoard("3", "Q2 Goals"));
    mockListBoards
      .mockResolvedValueOnce([
        { id: "1", name: "My Board", column_count: 5, card_count: 0 },
        { id: "2", name: "Project Phoenix", column_count: 5, card_count: 3 },
      ])
      .mockResolvedValueOnce([
        { id: "1", name: "My Board", column_count: 5, card_count: 0 },
        { id: "2", name: "Project Phoenix", column_count: 5, card_count: 3 },
        { id: "3", name: "Q2 Goals", column_count: 5, card_count: 0 },
      ]);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /switch board/i }));
    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    await userEvent.type(screen.getByPlaceholderText(/board name/i), "Q2 Goals");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => expect(mockCreateBoard).toHaveBeenCalledWith("Q2 Goals"));
  });

  it("persists the active board id in localStorage", async () => {
    mockFetchBoardById
      .mockResolvedValueOnce(makeBoard("1", "My Board", true))
      .mockResolvedValueOnce(makeBoard("2", "Project Phoenix"));
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /switch board/i }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByRole("option", { name: /Project Phoenix/i }));
    await waitFor(() => expect(localStorage.getItem("kanban.currentBoardId")).toBe("2"));
  });
});

describe("CardDetailModal integration", () => {
  it("opens the modal when the card is clicked", async () => {
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    expect(await screen.findByRole("dialog", { name: /card details/i })).toBeInTheDocument();
  });

  it("saves edited fields via updateCardOnBoard", async () => {
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    const dialog = await screen.findByRole("dialog");

    const title = within(dialog).getByLabelText(/title/i);
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed");

    await userEvent.click(within(dialog).getByRole("radio", { name: /high/i }));

    await userEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));
    expect(mockUpdateCardOnBoard).toHaveBeenCalledWith(
      "1",
      "1-c1",
      expect.objectContaining({ title: "Renamed", priority: "high" }),
    );
  });

  it("closes the modal on Escape", async () => {
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Labels integration", () => {
  it("renders no chips when card has no labels", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    expect(screen.queryByTestId(/card-label-/)).not.toBeInTheDocument();
  });

  it("renders chips for labels on a card", async () => {
    mockFetchBoardById.mockResolvedValueOnce({
      id: "1",
      name: "My Board",
      columns: [
        { id: "1-1", title: "Backlog", cardIds: ["1-c1"] },
        { id: "1-2", title: "Discovery", cardIds: [] },
        { id: "1-3", title: "In Progress", cardIds: [] },
        { id: "1-4", title: "Review", cardIds: [] },
        { id: "1-5", title: "Done", cardIds: [] },
      ],
      cards: {
        "1-c1": {
          id: "1-c1",
          title: "labeled",
          details: "",
          priority: "medium",
          due_date: null,
          labels: [{ id: "10", name: "Bug", color: "red" }],
        },
      },
    });
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    expect(await screen.findByTestId("card-label-10")).toHaveTextContent("Bug");
  });

  it("toggling a label from the picker calls setCardLabels", async () => {
    mockListLabels.mockResolvedValue([{ id: "10", name: "Bug", color: "red" }]);
    mockSetCardLabels.mockResolvedValue([{ id: "10", name: "Bug", color: "red" }]);
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: /manage labels/i }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /toggle bug/i }));
    await waitFor(() =>
      expect(mockSetCardLabels).toHaveBeenCalledWith("1", "1-c1", ["10"])
    );
  });
});

describe("Comments integration", () => {
  it("loads comments when the modal opens", async () => {
    mockListComments.mockResolvedValueOnce([
      {
        id: "c1",
        body: "looks good",
        author_id: "1",
        author_username: "user",
        created_at: new Date().toISOString(),
      },
    ]);
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    await screen.findByRole("dialog");
    expect(await screen.findByText("looks good")).toBeInTheDocument();
    expect(mockListComments).toHaveBeenCalledWith("1", "1-c1");
  });

  it("posts a new comment via createComment", async () => {
    mockListComments.mockResolvedValue([]);
    mockCreateComment.mockResolvedValueOnce({
      id: "c1",
      body: "hello there",
      author_id: "1",
      author_username: "user",
      created_at: new Date().toISOString(),
    });
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    await screen.findByRole("dialog");
    const textarea = screen.getByLabelText(/new comment/i);
    await userEvent.type(textarea, "hello there");
    await userEvent.click(screen.getByRole("button", { name: /^comment$/i }));
    await waitFor(() =>
      expect(mockCreateComment).toHaveBeenCalledWith("1", "1-c1", "hello there")
    );
    expect(await screen.findByText("hello there")).toBeInTheDocument();
  });

  it("shows empty placeholder when card has no comments", async () => {
    mockListComments.mockResolvedValue([]);
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });
});

describe("Columns CRUD", () => {
  it("renders the AddColumnTile and creates a new column", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByTestId("add-column-button"));
    const input = screen.getByLabelText(/column name/i);
    await userEvent.type(input, "Blocked");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(mockAddColumnOnBoard).toHaveBeenCalledWith("1", "Blocked")
    );
    expect(await screen.findByTestId("column-100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Blocked")).toBeInTheDocument();
  });

  it("delete button is disabled when only one column remains", async () => {
    mockFetchBoardById.mockResolvedValueOnce({
      id: "1",
      name: "My Board",
      columns: [{ id: "1-1", title: "Only", cardIds: [] }],
      cards: {},
    });
    render(<KanbanBoard />);
    await screen.findByTestId("column-1-1");
    const btn = screen.getByRole("button", { name: /delete column only/i });
    expect(btn).toBeDisabled();
  });

  it("deleting a column calls deleteColumnOnBoard and removes it from the board", async () => {
    // Provide a fresh response that includes a deletable column besides the default 5
    mockFetchBoardById.mockResolvedValueOnce({
      id: "1",
      name: "My Board",
      columns: [
        { id: "1-1", title: "Backlog", cardIds: [] },
        { id: "1-2", title: "Discovery", cardIds: [] },
      ],
      cards: {},
    });
    const original = window.confirm;
    window.confirm = () => true;
    try {
      render(<KanbanBoard />);
      await screen.findByTestId("column-1-1");
      await userEvent.click(screen.getByRole("button", { name: /delete column backlog/i }));
      await waitFor(() => expect(mockDeleteColumnOnBoard).toHaveBeenCalledWith("1", "1-1"));
      await waitFor(() => expect(screen.queryByTestId("column-1-1")).not.toBeInTheDocument());
    } finally {
      window.confirm = original;
    }
  });
});

describe("Filter integration", () => {
  const labeledBoard = () => ({
    id: "1",
    name: "My Board",
    columns: [
      { id: "1-1", title: "Backlog", cardIds: ["a", "b", "c"] },
      { id: "1-2", title: "Discovery", cardIds: [] },
      { id: "1-3", title: "In Progress", cardIds: [] },
      { id: "1-4", title: "Review", cardIds: [] },
      { id: "1-5", title: "Done", cardIds: [] },
    ],
    cards: {
      a: {
        id: "a",
        title: "Refactor API",
        details: "investigate slow endpoints",
        priority: "high",
        due_date: null,
        labels: [{ id: "10", name: "Backend", color: "blue" }],
      },
      b: {
        id: "b",
        title: "Design hero",
        details: "marketing landing page",
        priority: "low",
        due_date: null,
        labels: [],
      },
      c: {
        id: "c",
        title: "Audit invoices",
        details: "review for spelling",
        priority: "medium",
        due_date: null,
        labels: [{ id: "11", name: "Finance", color: "amber" }],
      },
    },
  });

  it("renders all cards when filter is empty", async () => {
    mockFetchBoardById.mockResolvedValueOnce(labeledBoard());
    mockListLabels.mockResolvedValueOnce([
      { id: "10", name: "Backend", color: "blue" },
      { id: "11", name: "Finance", color: "amber" },
    ]);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    expect(screen.getByText("Refactor API")).toBeInTheDocument();
    expect(screen.getByText("Design hero")).toBeInTheDocument();
    expect(screen.getByText("Audit invoices")).toBeInTheDocument();
    expect(screen.queryByTestId("filter-summary")).not.toBeInTheDocument();
  });

  it("hides cards that don't match a text search", async () => {
    mockFetchBoardById.mockResolvedValueOnce(labeledBoard());
    mockListLabels.mockResolvedValueOnce([]);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.type(screen.getByLabelText("Search cards"), "invoices");
    await waitFor(() => {
      expect(screen.queryByText("Refactor API")).not.toBeInTheDocument();
      expect(screen.queryByText("Design hero")).not.toBeInTheDocument();
      expect(screen.getByText("Audit invoices")).toBeInTheDocument();
    });
    expect(screen.getByTestId("filter-summary")).toHaveTextContent("1 / 3");
  });

  it("filters by priority", async () => {
    mockFetchBoardById.mockResolvedValueOnce(labeledBoard());
    mockListLabels.mockResolvedValueOnce([]);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("checkbox", { name: /filter priority high/i }));
    await waitFor(() => {
      expect(screen.getByText("Refactor API")).toBeInTheDocument();
      expect(screen.queryByText("Design hero")).not.toBeInTheDocument();
      expect(screen.queryByText("Audit invoices")).not.toBeInTheDocument();
    });
  });

  it("clear button resets all filters", async () => {
    mockFetchBoardById.mockResolvedValueOnce(labeledBoard());
    mockListLabels.mockResolvedValueOnce([]);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.type(screen.getByLabelText("Search cards"), "nope");
    expect(screen.queryByText("Refactor API")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^clear \(/i }));
    await waitFor(() => expect(screen.getByText("Refactor API")).toBeInTheDocument());
  });
});

describe("Archive modal", () => {
  it("opens the archive modal and shows an empty state", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /open archive/i }));
    expect(await screen.findByRole("dialog", { name: /archived cards/i })).toBeInTheDocument();
    expect(await screen.findByTestId("archive-empty")).toBeInTheDocument();
    expect(mockListArchivedCards).toHaveBeenCalledWith("1");
  });

  it("lists archived cards and restores one", async () => {
    mockListArchivedCards.mockResolvedValueOnce([
      {
        id: "10",
        title: "Old work",
        details: "leftover",
        priority: "medium",
        due_date: null,
        labels: [],
        comment_count: 0,
        archived_at: new Date().toISOString(),
        column_id: "1-1",
        column_title: "Backlog",
      },
    ]);
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /open archive/i }));
    expect(await screen.findByTestId("archived-card-10")).toHaveTextContent("Old work");

    await userEvent.click(screen.getByRole("button", { name: /restore old work/i }));
    await waitFor(() =>
      expect(mockRestoreCardOnBoard).toHaveBeenCalledWith("1", "10")
    );
    // Restored entry leaves the list
    await waitFor(() => expect(screen.queryByTestId("archived-card-10")).not.toBeInTheDocument());
  });

  it("purges with confirmation", async () => {
    mockListArchivedCards.mockResolvedValueOnce([
      {
        id: "11",
        title: "Forever gone",
        details: "",
        priority: "low",
        due_date: null,
        labels: [],
        comment_count: 0,
        archived_at: new Date().toISOString(),
        column_id: "1-1",
        column_title: "Backlog",
      },
    ]);
    const original = window.confirm;
    window.confirm = () => true;
    try {
      render(<KanbanBoard />);
      await screen.findAllByTestId(/^column-/);
      await userEvent.click(screen.getByRole("button", { name: /open archive/i }));
      await screen.findByTestId("archived-card-11");
      await userEvent.click(
        screen.getByRole("button", { name: /permanently delete forever gone/i })
      );
      await waitFor(() =>
        expect(mockPurgeArchivedCard).toHaveBeenCalledWith("1", "11")
      );
    } finally {
      window.confirm = original;
    }
  });
});

describe("Checklist integration", () => {
  it("adds a subtask via addChecklistItem", async () => {
    mockAddChecklistItem.mockResolvedValueOnce({
      id: "i1",
      text: "ship it",
      done: false,
      position: 0,
    });
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    await screen.findByRole("dialog");
    await userEvent.type(screen.getByLabelText(/new checklist item/i), "ship it");
    await userEvent.click(screen.getByRole("button", { name: /add subtask/i }));
    await waitFor(() =>
      expect(mockAddChecklistItem).toHaveBeenCalledWith("1", "1-c1", "ship it")
    );
    expect(await screen.findByText("ship it")).toBeInTheDocument();
  });

  it("toggles a subtask via updateChecklistItem", async () => {
    mockListChecklist.mockResolvedValueOnce([
      { id: "i1", text: "do thing", done: false, position: 0 },
    ]);
    mockUpdateChecklistItem.mockResolvedValueOnce({
      id: "i1",
      text: "do thing",
      done: true,
      position: 0,
    });
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    await screen.findByTestId("checklist-item-i1");
    await userEvent.click(screen.getByRole("checkbox", { name: /toggle do thing/i }));
    await waitFor(() =>
      expect(mockUpdateChecklistItem).toHaveBeenCalledWith("1", "1-c1", "i1", { done: true })
    );
  });

  it("deletes a subtask via deleteChecklistItem", async () => {
    mockListChecklist.mockResolvedValueOnce([
      { id: "i1", text: "trash me", done: false, position: 0 },
    ]);
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-1-c1");
    await userEvent.click(card);
    await screen.findByTestId("checklist-item-i1");
    await userEvent.click(screen.getByRole("button", { name: /delete trash me/i }));
    await waitFor(() =>
      expect(mockDeleteChecklistItem).toHaveBeenCalledWith("1", "1-c1", "i1")
    );
  });
});

describe("AI chat sidebar", () => {
  it("toggles open and closed via the AI button", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    expect(screen.queryByTestId("ai-sidebar")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    expect(screen.getByTestId("ai-sidebar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    expect(screen.queryByTestId("ai-sidebar")).not.toBeInTheDocument();
  });

  it("sends a message with the current board id", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    await userEvent.type(screen.getByLabelText(/message to ai/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText("Hello from AI!")).toBeInTheDocument();
    expect(mockSendChatMessage).toHaveBeenCalled();
    const args = mockSendChatMessage.mock.calls[0];
    expect(args[1]).toBe("1");
  });

  it("refreshes the active board when AI returns board_updates", async () => {
    mockSendChatMessage.mockResolvedValueOnce({
      message: "Added a card.",
      board_updates: [{ id: null, column_id: "1-1", title: "AI card", details: "", delete: false }],
    });
    render(<KanbanBoard />);
    await screen.findAllByTestId(/^column-/);
    await userEvent.click(screen.getByRole("button", { name: /toggle ai assistant/i }));
    await userEvent.type(screen.getByLabelText(/message to ai/i), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText("Added a card.")).toBeInTheDocument();
    // 1 initial + 1 after AI update
    await waitFor(() => expect(mockFetchBoardById).toHaveBeenCalledTimes(2));
  });
});
