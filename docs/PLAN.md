# Project Plan

## Part 1: Plan — COMPLETE

- [x] Explore existing frontend code
- [x] Create `frontend/AGENTS.md` describing existing frontend code
- [x] Enrich this PLAN.md with detailed steps, substeps, tests, and success criteria
- [x] User approves plan

---

## Part 2: Scaffolding

Set up Docker infrastructure, FastAPI backend, and start/stop scripts. Goal: a "hello world" page served via the container, plus a working `/api/health` endpoint confirmed by a browser and an API call.

### Steps
- [x] Create `backend/main.py` with FastAPI app; add a `GET /api/health` route returning `{"status": "ok"}`
- [x] Create `backend/pyproject.toml` (uv-managed) declaring `fastapi` and `uvicorn` as dependencies
- [x] Create `Dockerfile` (multi-stage):
  - Stage 1 `frontend-build`: `node:22-slim`, copies frontend, runs `npm ci && npm run build` — **not needed yet** (placeholder stage for Part 3)
  - Stage 1 `backend`: `ghcr.io/astral-sh/uv` base, installs Python deps with `uv sync`, copies `backend/`, serves static files from a `/app/static` directory with FastAPI `StaticFiles`
  - For now, place a minimal `static/index.html` ("hello world") directly in the image
- [x] Create `docker-compose.yml`: single service `app`, port `8000:8000`, volume mount for SQLite at `/app/data`
- [x] Create `scripts/start.sh` (Linux/Mac) and `scripts/start.bat` (Windows): `docker compose up --build -d`
- [x] Create `scripts/stop.sh` and `scripts/stop.bat`: `docker compose down`
- [x] Update `backend/AGENTS.md` with description of backend structure

### Tests & success criteria
- [x] `docker compose up --build` completes without error
- [x] `curl http://localhost:8000/` returns the hello-world HTML
- [x] `curl http://localhost:8000/api/health` returns `{"status":"ok"}`
- [x] `docker compose down` stops and removes the container cleanly
- [x] Backend has at least one pytest unit test for the health route (using `httpx` + `TestClient`)

---

## Part 3: Add in Frontend — COMPLETE

Replace the hello-world static file with the statically exported Next.js app, served by FastAPI.

### Steps
- [x] Confirm `next.config.ts` has `output: 'export'` and `trailingSlash: true`; add/update if needed
- [x] Update `Dockerfile`: add a proper `frontend-build` stage that runs `npm ci && npm run build` and exports to `/app/out`
- [x] In the backend stage, copy `/app/out` from the frontend-build stage into `/app/static`
- [x] Ensure FastAPI mounts `StaticFiles` at `/` with `html=True` so Next.js routing works, and that `/api/*` routes are still reachable
- [x] Run `npm run build` inside the container at image-build time; no pre-built files committed to repo

### Tests & success criteria
- [x] `docker compose up --build` completes without error
- [x] Browser at `http://localhost:8000/` shows the Kanban board (all 5 columns, sample cards)
- [x] Drag-and-drop works in the browser
- [x] `curl http://localhost:8000/api/health` still returns `{"status":"ok"}`
- [x] All existing frontend unit tests pass (`npm run test`)
- [x] Playwright e2e tests pass against the built app

---

## Part 4: Add in a fake user sign-in experience — COMPLETE

Protect the Kanban board behind a login screen. Credentials are hardcoded (`user` / `password`). No real auth library needed.

### Steps
- [x] Create `src/app/login/page.tsx`: form with username + password fields and a submit button
- [x] On submit, POST to `POST /api/auth/login` with `{username, password}`; backend validates hardcoded credentials and returns a session cookie (signed, HTTP-only, `SameSite=Strict`)
- [x] Add `POST /api/auth/login` and `POST /api/auth/logout` routes to FastAPI; use `itsdangerous` or similar for signing the cookie value
- [x] Add a middleware/dependency in FastAPI that rejects non-API routes except `/api/auth/*` when session cookie is absent — or handle auth purely on the frontend with a redirect
- [x] Frontend: on app load, call `GET /api/auth/me`; if 401, redirect to `/login`; if 200, show board
- [x] Add a "Log out" button in the board header that calls `POST /api/auth/logout` then redirects to `/login`
- [x] The session does not need to persist across container restarts for the MVP

### Tests & success criteria
- [x] Visiting `http://localhost:8000/` without a session redirects to `/login`
- [x] Logging in with correct credentials (`user` / `password`) shows the board
- [x] Logging in with wrong credentials shows an error message; board is not shown
- [x] Logging out redirects back to `/login`
- [x] Backend unit tests cover: correct login, wrong password, wrong username, logout, `/me` authenticated, `/me` unauthenticated
- [x] Playwright e2e test covers the full login → board → logout flow

---

## Part 5: Database modeling — COMPLETE

Design and document the SQLite schema before writing any database code.

### Steps
- [x] Design schema supporting multiple users (future-proof), one board per user (MVP), columns with ordered cards
- [x] Save schema as `docs/schema.json` (JSON representation of tables and columns)
- [x] Write a brief `docs/DATABASE.md` explaining the schema, the normalization decisions, and how ordering is handled
- [x] Get user sign-off before proceeding to Part 6

### Schema (proposed)
```
users         id (PK), username (unique), hashed_password
boards        id (PK), user_id (FK→users), name
columns       id (PK), board_id (FK→boards), title, position (int)
cards         id (PK), column_id (FK→columns), title, details, position (int)
```
Cards and columns use an integer `position` field for ordering (avoids array joins).

### Tests & success criteria
- [x] `docs/schema.json` and `docs/DATABASE.md` exist and are consistent with each other
- [x] User has reviewed and approved the schema

---

## Part 6: Backend — Database + API — COMPLETE

Implement the database layer and all Kanban API routes. The SQLite file lives at `/app/data/kanban.db`; it is created automatically on first run.

### Steps
- [x] Add `sqlalchemy` to `pyproject.toml`
- [x] Create `backend/database.py`: sync engine, `get_db` session dependency, `create_all` called on startup
- [x] Create `backend/models.py`: SQLAlchemy ORM models for `users`, `boards`, `columns`, `cards`
- [x] Seed the database on first run: create `user` account and an empty board with the 5 default columns (`backend/seed.py`)
- [x] Create `backend/routers/board.py` with routes:
  - `GET  /api/board` — returns full board for authenticated user (columns + cards in order)
  - `POST /api/board/columns/{col_id}/rename` — `{title: str}`
  - `POST /api/board/cards` — create card `{column_id, title, details}`
  - `DELETE /api/board/cards/{card_id}` — remove card
  - `POST /api/board/cards/{card_id}/move` — `{column_id, position}`
- [x] All routes require valid session (reuse auth dependency from Part 4)
- [x] Return consistent JSON matching the `BoardData` shape the frontend already uses

### Tests & success criteria
- [x] pytest suite covers all routes: happy path, unauthenticated (401), not-found (404)
- [x] Database is created from scratch if `/app/data/kanban.db` does not exist
- [x] All operations persist across a container restart (volume mount)
- [x] `GET /api/board` returns the 5 default columns for a fresh user

---

## Part 7: Frontend + Backend integration — COMPLETE

Wire the frontend to use the real backend API instead of hardcoded `initialData`.

### Steps
- [x] Create `src/lib/api.ts` with typed fetch wrappers for every backend route (no inline fetches in components)
- [x] Replace `initialData` usage in `KanbanBoard.tsx` with a `useEffect` that calls `GET /api/board` on mount
- [x] All mutations (rename column, add card, delete card, move card) call the corresponding API endpoint; update local state optimistically then sync with server response
- [x] On API error (non-2xx), show a non-intrusive toast/banner and revert optimistic update
- [x] Ensure the board re-fetches after any AI update (Part 10 preparation: expose a `refresh()` function)

### Tests & success criteria
- [x] Full flow works end-to-end: log in → see board → add card → refresh page → card persists
- [x] Moving a card persists across page reload
- [x] Renaming a column persists across page reload
- [x] Deleting a card persists across page reload
- [x] Frontend unit tests mock `src/lib/api.ts` and cover loading, error, and success states
- [x] Playwright e2e test covers the full persistence flow

---

## Part 8: AI connectivity

Add the ability for the backend to call the AI via OpenRouter.

### Steps
- [ ] Add `openai` Python package to `pyproject.toml` (OpenRouter is OpenAI-compatible)
- [ ] Create `backend/ai.py`: thin wrapper that creates an `AsyncOpenAI` client pointed at `https://openrouter.ai/api/v1`, using `OPENROUTER_API_KEY` from environment
- [ ] Load `.env` at container startup (via `python-dotenv` or Docker `env_file` directive in `docker-compose.yml`)
- [ ] Add `GET /api/ai/ping` route that sends "What is 2+2?" to the model and returns the raw text response — for smoke-testing only; remove or gate behind a dev flag before Part 10
- [ ] Ensure `OPENROUTER_API_KEY` is never logged or returned in API responses

### Tests & success criteria
- [ ] `curl http://localhost:8000/api/ai/ping` returns a response containing "4"
- [ ] Unit test mocks the OpenAI client and verifies the wrapper calls the correct model and base URL
- [ ] API key is read from environment; hardcoding it causes a test failure

---

## Part 9: AI chat backend

Extend the backend to accept conversation history + board state, and return a structured response that may include Kanban updates.

### Steps
- [ ] Define a Pydantic response model `AIChatResponse`:
  ```python
  class CardUpdate(BaseModel):
      id: str | None          # None = new card
      column_id: str | None
      title: str | None
      details: str | None
      delete: bool = False
  class AIChatResponse(BaseModel):
      message: str
      board_updates: list[CardUpdate] = []
  ```
- [ ] Create `POST /api/ai/chat` accepting `{messages: [{role, content}]}` (conversation history)
- [ ] The route fetches the current board for the user, injects it as a system message, appends the user messages, and calls the model with `response_format` set to JSON schema of `AIChatResponse`
- [ ] If `board_updates` is non-empty, apply each update to the database before returning
- [ ] Return the `AIChatResponse` to the client

### Tests & success criteria
- [ ] Unit test: mock AI response containing a `board_updates` entry → verify DB is updated and response is returned
- [ ] Unit test: mock AI response with empty `board_updates` → DB unchanged
- [ ] Unit test: malformed AI response → 500 with a clear error, no DB change
- [ ] Integration test (against live OpenRouter, only run manually / in CI with key): send "Add a card called Test Card to Backlog" → card appears in board

---

## Part 10: AI chat sidebar UI

Add a chat sidebar to the frontend that drives the AI endpoint and refreshes the board when the AI makes changes.

### Steps
- [ ] Create `src/components/AIChatSidebar.tsx`: a collapsible right-side panel with:
  - Message history (user and assistant bubbles)
  - Text input + Send button
  - Loading spinner while waiting for response
- [ ] Sidebar state (open/closed, message history) lives in `KanbanBoard.tsx` or a context; keep it simple
- [ ] On Send: POST to `/api/ai/chat` with the full message history; append assistant reply to history
- [ ] If response contains `board_updates`, call the board `refresh()` function to re-fetch from `/api/board`
- [ ] Style using existing CSS custom properties (no new color values)
- [ ] Add a toggle button in the board header to open/close the sidebar

### Tests & success criteria
- [ ] Sidebar opens and closes via the toggle button
- [ ] Sending a message shows a loading state, then the assistant reply
- [ ] When the AI returns board updates, the board re-renders with the changes without a full page reload
- [ ] Frontend unit tests cover: sending a message, receiving a reply, board refresh on update
- [ ] Playwright e2e test: log in, open sidebar, type a message, verify a reply appears