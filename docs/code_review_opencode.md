# Code Review — OpenCode Implementation

This review covers the implementation work done by OpenCode during the build session, focusing on correctness, architecture, and maintainability.

---

## Summary

The implementation is functional and well-structured overall. The frontend is built with Next.js App Router, Tailwind CSS v4, and `@dnd-kit` for drag-and-drop. The backend is a FastAPI application with SQLAlchemy, cookie-based auth, and OpenRouter integration. The Docker multi-stage build is correct. Most issues found are minor; there are no critical security vulnerabilities or architectural red flags that would block an MVP launch.

---

## Bugs

### B1. CSS variable name mismatch — two buttons have no background (HIGH)

`globals.css` defines `--secondary-purple`, but two components reference the non-existent `--purple-secondary`:

- `frontend/src/app/login/page.tsx:87` — the "Sign in" button
- `frontend/src/components/AIChatSidebar.tsx:192` — the "Send" button

`NewCardForm.tsx:48` uses the correct name. The mismatched buttons silently fall back to transparent backgrounds.

**Action:** Replace `--purple-secondary` with `--secondary-purple` in both files.

### B2. Column rename fires on every keystroke (MEDIUM)

`KanbanColumn.tsx:44` calls `onRename` inside `onChange`. Each character typed dispatches a `POST /api/board/columns/{id}/rename` request, flooding the backend and creating race conditions.

**Action:** Debounce the rename call or switch to `onBlur` for the commit.

### B3. AI card delete does not compact positions (MEDIUM)

`routers/ai.py:82-83` — `_apply_updates` deletes a card but does not renumber the remaining cards in the column. This leaves gaps in `position` ordering, which can cause incorrect card ordering on subsequent operations. The non-AI `board.py:120-130` handles this correctly.

**Action:** After deleting a card in `_apply_updates`, compact positions for the affected column using the same logic as `board.py:delete_card`.

### B4. AI card move does not compact the source column (LOW)

`routers/ai.py:89-98` — when a card is moved to a new column, `_apply_updates` appends to the target but does not compact positions in the source column. `board.py:move_card` handles this correctly.

**Action:** Add source-column position compaction to `_apply_updates` when `type == "move"`.

### B5. Error timer not cleaned up on unmount (LOW)

`KanbanBoard.tsx:28-33` — `errorTimer.current` is set via `setTimeout` but never cleared when the component unmounts, which can call `setError` on an unmounted component.

**Action:** Add a `useEffect` cleanup that clears `errorTimer.current`.

---

## Security

### S1. `/api/ai/ping` has no auth guard (HIGH)

`routers/ai.py:17-20` — the ping endpoint calls OpenRouter without any authentication. Anyone who can reach the server can consume API credits.

**Action:** Add `username: str = Depends(require_auth)` to the `ping` endpoint.

### S2. Documentation claims bcrypt but code uses SHA-256 (MEDIUM)

`docs/DATABASE.md:8` states "hashed_password stores a bcrypt hash", but `seed.py:13` uses `hashlib.sha256`. Meanwhile `auth.py:9` compares credentials in plaintext against a hardcoded dict, so the hashed_password column is never actually checked during login. Acceptable for MVP, but the docs and implementation are inconsistent.

**Action:** Update `DATABASE.md` to say "SHA-256 (MVP only)" and add a clarifying comment in `seed.py`.

### S3. AI message role field accepts arbitrary strings (LOW)

`routers/ai.py:26` — `MessageIn.role` accepts any string. A client could inject `"system"` role messages, potentially manipulating AI behavior.

**Action:** Constrain `role` to `Literal["user", "assistant"]` in the Pydantic model.

---

## Architecture & Code Quality

### A1. `require_auth` and `_get_board` are in the wrong module (MEDIUM)

`require_auth` and `_get_board` are defined in `routers/board.py` but imported by `routers/ai.py`. These are shared dependencies, not board-specific.

**Action:** Move `require_auth` to `backend/auth.py` and `_get_board` to a shared `backend/deps.py`.

### A2. AIChatSidebar uses inline styles instead of Tailwind (MEDIUM)

Every other component uses Tailwind utility classes, but `AIChatSidebar.tsx` uses inline `style={{}}` for all styling. This breaks consistency and makes the sidebar harder to maintain alongside the rest of the design system.

**Action:** Convert inline styles to Tailwind classes.

### A3. Raw `fetch` calls bypass `lib/api.ts` (LOW)

The project convention is that all API calls go through `lib/api.ts`, but three places bypass it:

- `KanbanBoard.tsx:146` — `fetch("/api/auth/logout", ...)`
- `AuthGuard.tsx:11` — `fetch("/api/auth/me")`
- `login/page.tsx:18` — `fetch("/api/auth/login", ...)`

**Action:** Add `login()`, `logout()`, and `checkAuth()` wrappers to `lib/api.ts`.

### A4. Dead exports in `kanban.ts` (LOW)

`initialData` (line 18) and `createId` (line 164) are exported but never imported anywhere. These are leftovers from the pre-API hardcoded data era.

**Action:** Remove both exports.

### A5. AI board snapshot omits card details (LOW)

`routers/ai.py:50-53` — the snapshot sent to the AI includes `id` and `title` but not `details`. This limits the AI's ability to understand and act on the full board state.

**Action:** Include `"details": c.details` in the card snapshot dict.

### A6. AIChatSidebar message input loses focus on Enter (LOW)

`AIChatSidebar.tsx:160-168` — the message input uses `onKeyDown` to submit on Enter. If the message fails to send, the input does not retain focus, and the user may not notice the error. Additionally, sending an empty message is guarded but the Enter handler does not prevent double-submission during the async call.

**Action:** Disable the input during the async request and restore focus on error.

### A7. No rate limiting on AI chat endpoint (LOW)

`POST /api/ai/chat` has no rate limiting. A user could spam the endpoint and consume significant API credits or cause performance degradation.

**Action:** Consider adding simple rate limiting (e.g., `slowapi` or a manual counter per session).

---

## Testing

### T1. Backend test fixtures are duplicated across files (MEDIUM)

`test_board.py` and `test_ai.py` each define nearly identical `client`/`db_client` fixtures. No `conftest.py` exists, so the same setup is repeated.

**Action:** Create `backend/tests/conftest.py` with shared fixtures.

### T2. `test_auth.py` and `test_health.py` don't override the database (MEDIUM)

`test_auth.py:7-9` and `test_health.py:4` create `TestClient(app)` without overriding `get_db`. This triggers the app lifespan which calls `create_tables()` and `os.makedirs("/app/data")`. Both tests fail when `/app/data` cannot be created (e.g., in environments without that directory).

Both tests only pass because they don't actually use the database — but the lifespan fires regardless.

**Action:** Use the shared in-memory DB fixture from `conftest.py`, or set `DATA_DIR` to a temp directory in pytest configuration.

### T3. No frontend test for delete card (LOW)

`KanbanBoard.test.tsx` covers add card, rename column, AI chat, and error states, but has no test for the delete card flow.

**Action:** Add a test that deletes a card and verifies it's removed from the DOM.

### T4. No unit test for `AuthGuard` (LOW)

`AuthGuard.tsx` has no dedicated unit tests. E2e tests cover it indirectly, but a unit test verifying redirect-on-401 and render-on-200 would improve confidence.

**Action:** Add a unit test for `AuthGuard`.

### T5. No integration test for AI board updates (LOW)

The Playwright e2e test (`tests/kanban.spec.ts`) covers login, card CRUD, drag-and-drop, and AI chat message display — but does not verify that AI-requested board changes (card creation, moves, deletes) actually persist in the database.

**Action:** Add an e2e test that uses the AI to create or move a card, then verifies the change persists on reload.

---

## Documentation

### D1. Inline comments are sparse (INFO)

The implementation is clean and readable, but certain non-obvious pieces lack comments — for example, `_apply_updates` in `routers/ai.py` and the position compaction logic in `board.py`. A future maintainer may not immediately understand why positions are compacted or how AI board updates are applied.

**Action:** Add comments to `_apply_updates`, position compaction blocks, and the drag-and-drop state machine in `KanbanBoard.tsx`.

### D2. No API changelog (INFO)

There is no `API.md` or changelog documenting the available endpoints, request/response shapes, and error codes. This is acceptable for an MVP with a known frontend consumer, but should be added before the API is consumed by any additional clients.

---

## Items Already Handled Correctly

The following are worth noting as positives, not issues:

- The Docker multi-stage build correctly separates the frontend build from the backend runtime.
- The `output: "export"` config in `next.config.ts` is appropriate for the static export approach.
- Cookie-based auth with `itsdangerous` signing is a reasonable approach for a single-server MVP.
- The optimistic update pattern in `KanbanBoard.tsx` with rollback on error is implemented correctly.
- The `conftest.py` note in the explore agent's summary (that it doesn't exist) is a false positive — `conftest.py` was not in the codebase before, which aligns with T1 above.

---

## Priority Summary

| Priority | Count | Items |
|----------|-------|-------|
| HIGH | 2 | B1, S1 |
| MEDIUM | 7 | B2, B3, S2, A1, A2, T1, T2 |
| LOW | 12 | B4, B5, S3, A3, A4, A5, A6, A7, T3, T4, T5 |
| INFO | 2 | D1, D2 |

Total: 23 findings. The two HIGH items (CSS variable and missing auth on AI ping) are the most impactful and should be addressed first.
