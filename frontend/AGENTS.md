# Frontend

## Overview

A Next.js 16 / React 19 app using Tailwind CSS v4, dnd-kit for drag-and-drop, and TypeScript. Currently a pure client-side demo with no backend connectivity. It is tested with Vitest (unit) and Playwright (e2e).

## File structure

```
src/
  app/
    globals.css       # CSS custom properties (color tokens, shadows) + Tailwind base
    layout.tsx        # Root layout: loads Space Grotesk (display) and Manrope (body) fonts
    page.tsx          # Entry point - renders <KanbanBoard />
  components/
    KanbanBoard.tsx   # Top-level board: owns all state, DndContext, renders columns
    KanbanColumn.tsx  # One column: droppable, renders its cards + NewCardForm
    KanbanCard.tsx    # One card: sortable, shows title/details/remove button
    KanbanCardPreview.tsx  # Static card shown in DragOverlay while dragging
    NewCardForm.tsx   # Expandable form (title + textarea) to add a card to a column
  lib/
    kanban.ts         # Types (Card, Column, BoardData), initialData, moveCard(), createId()
    kanban.test.ts    # Vitest unit tests for moveCard
  test/
    setup.ts          # @testing-library/jest-dom setup
    vitest.d.ts       # Vitest type augmentation
tests/
  kanban.spec.ts      # Playwright e2e tests
```

## Key data types (lib/kanban.ts)

```ts
type Card   = { id: string; title: string; details: string }
type Column = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

Board state is normalized: columns hold ordered card IDs, cards are looked up by ID.

## State and behaviour (KanbanBoard.tsx)

- `board: BoardData` — single useState holding the full board
- `activeCardId` — tracks the card being dragged (for DragOverlay)
- `handleDragEnd` — calls `moveCard()` and updates columns
- `handleRenameColumn` — inline edit of column title
- `handleAddCard` — creates a new card via `createId()` and appends it to the column
- `handleDeleteCard` — removes card from both `cards` map and column's `cardIds`

## Dependencies

| Package | Purpose |
|---|---|
| `@dnd-kit/core` | Drag-and-drop context and sensors |
| `@dnd-kit/sortable` | Sortable list within each column |
| `@dnd-kit/utilities` | CSS transform helpers |
| `clsx` | Conditional classNames |
| `next` 16 / `react` 19 | Framework |
| `tailwindcss` v4 | Styling (utility classes + CSS custom properties) |

## Test commands

```
npm run test          # Vitest unit tests (once)
npm run test:unit:watch  # Vitest in watch mode
npm run test:e2e      # Playwright e2e tests
npm run test:all      # Both
```

## Notes for agents

- All colors are CSS custom properties defined in globals.css; never hardcode hex values in components.
- The board has exactly 5 fixed columns (Backlog, Discovery, In Progress, Review, Done); column count is not configurable.
- `initialData` in kanban.ts will be replaced by an API call once the backend exists; keep the structure identical.
- When connecting to the backend, introduce an API layer in `src/lib/api.ts`; do not inline fetch calls in components.
- The app currently has no auth UI; a login page will be added at `/login` before the board is accessible.
