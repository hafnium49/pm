# Simplification Pass — 2026-05-14

Behavior-preserving cleanup across the full repository. Driven by the
`code-simplifier:code-simplifier` agent (frontend and backend in parallel).
Goal: remove dead code, collapse duplication, flatten control flow. No API
contracts, route shapes, or user-visible behavior changed.

Verification at the end of the pass:

- Frontend: `npm run lint` clean (one pre-existing warning in
  `tests/sharing.spec.ts`, untouched), `npm run test` 52/52 pass,
  `npx tsc --noEmit` 0 errors in production sources.
- Backend: `uv run pytest` 223/223 pass.
- Docker build + `./scripts/start.sh` boots the stack on `:8000`; root returns
  200, `/api/auth/me` returns 401 when unauthenticated (expected).

---

## Frontend

### Helpers and shared types

- `frontend/src/lib/cardFilter.ts` — `isFilterActive` and `activeFilterCount`
  now share an `activeFacets` helper so each filter facet is listed once
  instead of in two parallel structures. The nested `if`/`else if` chain in
  the due-date matcher was lifted into a `dueMatches` helper expressed as a
  `switch`, per the CLAUDE.md "no nested ternaries / prefer switch" guideline.

- `frontend/src/components/labelColors.ts` — added shared
  `PRIORITY_DOT_CLASS`. Previously duplicated as `PRIORITY_COLOR` in both
  `KanbanCard.tsx` and `KanbanCardPreview.tsx`.

### Card components

- `KanbanCard.tsx` — uses the shared `PRIORITY_DOT_CLASS`. Inline `clsx`
  boolean cascades and a nested ternary in the badge `title` were replaced
  with two small maps (`DUE_BADGE_CLASS`, `DUE_STATUS_SUFFIX`) keyed by a
  `DueStatus` union. `card.priority ?? "medium"` and the three `?? 0` count
  fallbacks were lifted into local consts to deduplicate.

- `KanbanCardPreview.tsx` — uses the shared `PRIORITY_DOT_CLASS`; removed
  the local `as Priority` cast.

- `CardDetailModal.tsx` — replaced a nested ternary in the priority-button
  classes with a per-option `activeClass` baked into `PRIORITY_OPTIONS`.
  Replaced `Parameters<Props["onSave"]>[0]` with the exported `CardUpdate`
  type from `lib/api`.

### Board state

- `KanbanBoard.tsx` — the largest cleanup:
  - Dropped a `useMemo` wrapping `cardsById` (it just returned `board.cards`).
  - Replaced the local `ActiveBoard`/`BoardData` aliases with the exported
    `BoardFull` from `lib/api`.
  - `loadBoard`, `handleCreateBoard`, and `handleAddColumn` now assign the
    API response directly instead of rebuilding `{ id, name, columns, cards }`
    by hand.
  - Replaced an unsafe `as typeof board.columns` cast in `handleReorderColumns`
    with `flatMap`.
  - Rewrote `handleUpdateCard` from a spread-with-conditional-ternary chain
    into a sequence of `if` statements building an `optimistic` card.
  - Extracted a `patchCard` helper; expressed `bumpCommentCount` and
    `bumpChecklistTotals` through it. Folded the single-use
    `setCardLabelsLocally` directly into its caller.
  - Added a generic `patchCardLabels` helper used by `handleRenameLabel` and
    `handleDeleteLabel` (the two were 8-line copies of each other).
  - `handleRenameBoard` computes `prevName` up front instead of re-searching
    on rollback.
  - `handleDeleteColumn` uses a `Set` for `removedCardIds`.
  - `handleDeleteCard` uses `{...board.cards}` + `delete` instead of
    `Object.entries().filter().fromEntries()`.
  - Extracted a `HEADER_ICON_BUTTON` class constant for the three header
    icon buttons.
  - Replaced the filtered-columns `useMemo` with `let` + `if/else if/else`
    (the memo was identity-equal, not a perf win, and hid the control flow).

### Misc

- `NewCardForm.tsx` — replaced a single `formState` object plus spread
  updates with two `useState` strings plus a single `reset` helper. Inverted
  the closed-state branch to an early return.
- `BoardSwitcher.tsx` — collapsed two `useEffect` hooks with identical
  `[open]` dependencies into one.
- `AccountSettingsModal.tsx`, `CommentsSection.tsx`, `MembersModal.tsx` —
  dropped narrative comments that restated the mount/unmount lifecycle.

### Intentionally left alone

- The inline `fetch("/api/auth/...")` calls in `AuthGuard.tsx`,
  `src/app/login/page.tsx`, `src/app/register/page.tsx`, and parts of
  `KanbanBoard.tsx`. CLAUDE.md says all API calls should go through
  `lib/api.ts`, but moving these would have required extending the
  `vi.mock("@/lib/api", ...)` mock list in `KanbanBoard.test.tsx` —
  test-file churn driven by style rather than a production bug.
- `icons.tsx`, `AddColumnTile.tsx`, `AIChatSidebar.tsx`, `ArchiveModal.tsx`,
  `ChecklistSection.tsx`, `FilterBar.tsx`, `KanbanColumn.tsx`,
  `LabelPicker.tsx`, and the rest of `src/app/*` — already concise.

---

## Backend

### Shared helpers in `routers/boards.py`

- `get_active_card_on_board(...)` — single accessor that resolves a
  non-archived card on a board the caller can access. Replaced the
  duplicated 14-line lookup helpers in `comments.py` and `checklist.py`.
- `_move_card_within_board(...)` — extracts the ~25-line
  card-move-and-renumber procedure that was duplicated verbatim between
  `boards.py` and the legacy `board.py`.

### Per-router cleanups

- `routers/board.py` — legacy `move_card` now delegates to
  `_move_card_within_board`. ~25 lines of duplicate logic gone.
- `routers/ai.py` — `_apply_updates` was a 60+ line nested function;
  split into `_find_active_card`, `_create_card`, `_archive_card`,
  `_move_card_to_column`, `_update_card`. Move/archive paths now reuse
  `_compact_active_positions` from `boards.py` instead of re-implementing
  it twice inline. Lifted the inline `from datetime import ...` to module
  top, and pulled the system prompt out into a module constant.
- `routers/comments.py` — removed the local `_get_card_on_board` helper
  (8 lines) plus the imports that only it needed (`KanbanCard`,
  `KanbanColumn`, `Session`, the `deps` covered by them); routes call
  `get_active_card_on_board` directly.
- `routers/checklist.py` — same treatment as `comments.py`; also added a
  small `_get_item(db, card_id, item_id)` helper to dedupe the "find item
  or 404" snippet that appeared in two routes.
- `routers/labels.py` — extracted the duplicated `try / db.commit() /
  except IntegrityError → 409` block into a `_commit_label(db)` helper
  and made the duplicate-name message a module constant.
- `routers/members.py` — `remove_member` no longer duplicates the board
  lookup and `effective_role` no-access dance; it calls `get_readable_board`
  (which raises 404 for non-members) and then does the finer-grained
  owner/self permission check. Removed the unused `Board` import.

### Infrastructure

- `main.py` — iterates a router list instead of repeating
  `app.include_router(...)` for each one.
- `database.py` — hoisted the lazy `from backend.models import Base` to
  the top of the module; the lifespan uses a `with SessionLocal() as db`
  context manager.
- `deps.py` — renamed the private `_check` helper to `_board_with_role`
  for clarity.

### Intentionally left alone

- `auth.py` — the legacy SHA-256 auto-upgrade path is covered by
  `test_security.py::test_legacy_login_is_auto_upgraded`. Removing it
  would break tests.
- `update_card` in `boards.py` — the explicit
  `if field is not None: card.field = field` chain is the clearest form
  for partial updates.
- `restore_card` fallback to the first column — that fallback is correct
  behavior, not defensive cruft. A column can legitimately be deleted
  while a card is archived.
- `invite_member` keeps both the explicit "already a member" check and the
  `IntegrityError` catch — the catch is a real race guard, not duplication.
- `models.py`, `security.py`, `seed.py`, `ai.py` (the OpenRouter wrapper) —
  already minimal.

---

## Notes for future passes

- The frontend still has direct `fetch` calls for the auth endpoints that
  bypass `lib/api.ts`. Worth consolidating in a follow-up that also updates
  the `KanbanBoard.test.tsx` mock list.
- `boards.py` now hosts two shared helpers (`get_active_card_on_board`,
  `_move_card_within_board`) plus `_compact_active_positions`. If a third
  router needs them, consider promoting them to a `routers/_shared.py`
  module to keep `boards.py` focused on its own routes.
- Running the backend test suite from a host that exports the ROS
  `PYTHONPATH` (`/opt/ros/jazzy/lib/python3.12/site-packages`) requires
  `PYTHONPATH="" uv run pytest` to avoid `launch_testing` being loaded as
  a stray pytest plugin. Environment quirk, not a project issue.
