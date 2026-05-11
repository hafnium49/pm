# Code Review

Comprehensive review of the Kanban Studio repository. Findings are grouped by category and sorted by severity within each group.

---

## Bugs

### B1. CSS variable name mismatch — buttons render with no background (HIGH)

`globals.css` defines `--secondary-purple`, but two files reference the non-existent `--purple-secondary`:

- `frontend/src/app/login/page.tsx:87` — the "Sign in" button
- `frontend/src/components/AIChatSidebar.tsx:192` — the "Send" button

`NewCardForm.tsx:48` uses the correct `--secondary-purple`. The mismatched buttons silently fall back to transparent.

**Action:** Replace `--purple-secondary` with `--secondary-purple` in both files.

### B2. Column rename fires an API call on every keystroke (MEDIUM)

`KanbanColumn.tsx:44` calls `onRename(column.id, event.target.value)` inside `onChange`. Each character typed dispatches a `POST /api/board/columns/{id}/rename` request. This floods the backend and creates race conditions where an earlier request may resolve after a later one.

**Action:** Debounce the API call (e.g. 400ms) or switch to `onBlur` for the rename commit.

### B3. AI card delete does not compact positions (MEDIUM)

`routers/ai.py:82-83` — `_apply_updates` deletes a card but does not renumber the remaining cards in the column. Compare with `routers/board.py:120-130` which explicitly compacts positions after delete. This leaves gaps in position ordering, which can cause incorrect card ordering on subsequent operations.

**Action:** After deleting a card in `_apply_updates`, compact positions for the affected column, matching the logic in `board.py:delete_card`.

### B4. AI card move does not compact the source column (LOW)

`routers/ai.py:89-98` — when the AI moves a card to a new column, it appends to the end of the target column but does not compact positions in the source column. `board.py:move_card` handles this correctly.

**Action:** Apply the same source-column compaction logic from `board.py:move_card`.

### B5. Error timer not cleaned up on unmount (LOW)

`KanbanBoard.tsx:28-33` — `errorTimer.current` is set via `setTimeout` but never cleared when the component unmounts. If the component unmounts before the timer fires, it will call `setError` on an unmounted component.

**Action:** Add a `useEffect` cleanup that clears `errorTimer.current` on unmount.

---

## Security

### S1. `/api/ai/ping` has no auth guard (HIGH)

`routers/ai.py:17-20` — the ping endpoint calls OpenRouter without any authentication. Anyone who can reach the server can consume API credits.

**Action:** Add `username: str = Depends(require_auth)` to the `ping` endpoint.

### S2. Documentation claims bcrypt but code uses SHA-256 (MEDIUM)

`docs/DATABASE.md:8` states "hashed_password stores a bcrypt hash", but `seed.py:13` uses `hashlib.sha256`. Meanwhile `auth.py:9` compares passwords in plaintext against a hardcoded dict, so the hash in the database is never actually checked during login. The hashed_password column is effectively unused.

This is fine for the MVP's hardcoded single user, but the code and docs are inconsistent and the password hash is misleading.

**Action:** Either (a) update `DATABASE.md` to say "SHA-256 (MVP only)" and add a comment in `seed.py`, or (b) make login actually check against the database using a proper hash.

### S3. AI message role field is unvalidated (LOW)

`routers/ai.py:26` — `MessageIn.role` accepts any string. A client could inject `"system"` role messages into the conversation, potentially overriding the system prompt or manipulating the AI's behavior.

**Action:** Constrain `role` to `Literal["user", "assistant"]` in the Pydantic model.

---

## Architecture & Code Quality

### A1. `require_auth` and `_get_board` live in the wrong module (MEDIUM)

`require_auth` and `_get_board` are defined in `routers/board.py` but imported by `routers/ai.py`. These are shared dependencies, not board-specific.

**Action:** Move `require_auth` to `backend/auth.py` (alongside the other auth code) and `_get_board` to a shared `backend/deps.py` or similar.

### A2. AIChatSidebar uses inline styles instead of Tailwind (MEDIUM)

Every other component uses Tailwind utility classes, but `AIChatSidebar.tsx` uses inline `style={{}}` for all its styling. This breaks consistency with the rest of the frontend and makes the styling harder to maintain.

**Action:** Convert the inline styles to Tailwind classes.

### A3. Raw `fetch` calls outside `lib/api.ts` (LOW)

The project convention is that all API calls go through `lib/api.ts`, but three places bypass it:

- `KanbanBoard.tsx:146` — `fetch("/api/auth/logout", ...)`
- `AuthGuard.tsx:11` — `fetch("/api/auth/me")`
- `login/page.tsx:18` — `fetch("/api/auth/login", ...)`

**Action:** Add `login()`, `logout()`, and `checkAuth()` wrappers to `lib/api.ts` and use them.

### A4. Dead exports in `kanban.ts` (LOW)

`initialData` (line 18) and `createId` (line 164) are exported but never imported anywhere. These are leftovers from the pre-API hardcoded data.

**Action:** Remove both.

### A5. `_board_snapshot` omits card details (LOW)

`routers/ai.py:50-53` — the snapshot sent to the AI includes card `id` and `title` but not `details`. This limits the AI's ability to understand and edit the full board state.

**Action:** Include `"details": c.details` in the card snapshot dict.

---

## Testing

### T1. Backend test fixtures duplicated across files (MEDIUM)

`test_board.py` and `test_ai.py` each define nearly identical `client`/`db_client` fixtures that create an in-memory SQLite database, seed it, and override `get_db`. No `conftest.py` exists.

**Action:** Create `backend/tests/conftest.py` with shared fixtures.

### T2. `test_auth.py` and `test_health.py` don't override the database (MEDIUM)

`test_auth.py:7-9` and `test_health.py:4` create `TestClient(app)` without overriding `get_db`. This triggers the app lifespan which calls `create_tables()` and `os.makedirs("/app/data")`. These tests only pass outside Docker because:
- `test_health.py` — the health endpoint doesn't use the DB, but the lifespan still fires.
- `test_auth.py` — same issue; auth tests use hardcoded credentials, not the DB.

Both fail if `/app/data` can't be created (as we saw when running tests locally without `DATA_DIR`).

**Action:** Use the shared in-memory DB fixture from `conftest.py` for all test files, or set `DATA_DIR` to a temp directory in the pytest configuration.

### T3. No test for delete card in frontend (LOW)

`KanbanBoard.test.tsx` covers add card, rename column, AI chat, and error states, but has no test for the delete card flow.

**Action:** Add a test that deletes a card and verifies it's removed from the DOM.

### T4. No test for `AuthGuard` component (LOW)

`AuthGuard.tsx` has no dedicated unit tests. It's covered indirectly by e2e tests, but a unit test verifying redirect-on-401 and render-on-200 behavior would improve confidence.

**Action:** Add a unit test for `AuthGuard`.

---

## Summary

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| B1 | HIGH | Bug | `--purple-secondary` CSS variable does not exist; two buttons have no background |
| S1 | HIGH | Security | `/api/ai/ping` has no auth; anyone can burn API credits |
| B2 | MEDIUM | Bug | Column rename API call fires on every keystroke |
| B3 | MEDIUM | Bug | AI card delete does not compact positions |
| S2 | MEDIUM | Security | DATABASE.md says bcrypt, code uses SHA-256, login uses neither |
| A1 | MEDIUM | Architecture | `require_auth` / `_get_board` in wrong module |
| A2 | MEDIUM | Architecture | AIChatSidebar uses inline styles, rest uses Tailwind |
| T1 | MEDIUM | Testing | Duplicated test fixtures, no conftest.py |
| T2 | MEDIUM | Testing | Auth and health tests break without `/app/data` |
| B4 | LOW | Bug | AI card move does not compact source column |
| B5 | LOW | Bug | Error timer not cleaned up on unmount |
| S3 | LOW | Security | AI message role field accepts arbitrary strings |
| A3 | LOW | Architecture | Raw fetch calls bypass lib/api.ts convention |
| A4 | LOW | Architecture | Dead exports: `initialData`, `createId` |
| A5 | LOW | Architecture | AI board snapshot omits card details |
| T3 | LOW | Testing | No frontend test for delete card |
| T4 | LOW | Testing | No unit test for AuthGuard |
