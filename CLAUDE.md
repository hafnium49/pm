# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kanban Studio — a full-stack project management app with a Next.js 16 frontend (static export) served by a FastAPI backend, packaged in Docker. Single-user MVP with AI chat sidebar for board manipulation.

## Common Commands

### Docker (production)
```bash
./scripts/start.sh          # docker compose up --build -d (serves on :8000)
./scripts/stop.sh           # docker compose down
```

### Frontend (in `frontend/`)
```bash
npm install                 # install dependencies
npm run dev                 # dev server on :3000
npm run build               # static export to out/
npm run lint                # ESLint
npm run test                # vitest unit tests (single run)
npm run test:unit:watch     # vitest in watch mode
npm run test:e2e            # playwright e2e tests
npm run test:all            # unit + e2e
```

Run a single test file: `npx vitest run src/lib/kanban.test.ts`

### Backend (in project root, uses `uv`)
```bash
uv sync                     # install dependencies
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
uv run pytest               # all backend tests
uv run pytest backend/tests/test_board.py          # single test file
uv run pytest backend/tests/test_board.py -k "test_name"  # single test
```

## Architecture

**Frontend** (`frontend/src/`): Next.js 16 / React 19 / TypeScript / Tailwind v4. Static export (`output: 'export'`). All API calls go through `lib/api.ts` — no inline fetch. Board state is a single `useState<BoardData>` in `KanbanBoard.tsx` with optimistic updates that revert on error.

**Backend** (`backend/`): FastAPI with SQLAlchemy ORM on SQLite (`/app/data/kanban.db`). Session auth via signed cookies (`itsdangerous`). Database seeding in `seed.py` creates default user (`user`/`password`) and 5 columns.

**Data flow**: Normalized board data — columns hold `cardIds` arrays, cards stored in a flat `Record<string, Card>`. Frontend fetches full board from `GET /api/board`, applies optimistic mutations, syncs via POST/DELETE endpoints.

**AI**: Backend injects current board state into system prompt, calls OpenRouter (`openai/gpt-oss-120b`), gets structured JSON with `{message, board_updates[]}`, applies updates to DB, frontend refreshes board.

**Docker**: Multi-stage build — stage 1 builds frontend static export (node:22-slim), stage 2 runs backend (uv/python3.12) and serves static files. Single service on port 8000.

## Key API Routes

- `POST /api/auth/login` — `{username, password}`, sets session cookie
- `GET /api/board` — returns `{columns, cards}`
- `POST /api/board/cards` — create card `{column_id, title, details}`
- `POST /api/board/cards/{id}/move` — `{column_id, position}`
- `DELETE /api/board/cards/{id}`
- `POST /api/board/columns/{id}/rename` — `{title}`
- `POST /api/ai/chat` — `{messages}` → `{message, board_updates}`

## Testing

- **Frontend unit**: Vitest + jsdom + @testing-library (`src/**/*.test.ts`)
- **Frontend e2e**: Playwright + Chromium (`tests/**/*.spec.ts`), auto-starts dev server
- **Backend**: pytest + httpx TestClient (`backend/tests/test_*.py`)

## Coding Conventions

- No hardcoded colors — use CSS custom properties defined in `globals.css`
- 5 fixed board columns (not configurable, but renamable)
- All frontend API calls must use `lib/api.ts` typed wrappers
- Drag-and-drop via `@dnd-kit`
- Fonts: Space Grotesk (display), Manrope (body) via Next.js Google Fonts
- No emojis in code or docs
- Identify root causes before fixing — prove with evidence

## Environment Variables

- `OPENROUTER_API_KEY` — required for AI features (in `.env`, loaded by docker-compose)
- `SECRET_KEY` — session signing (defaults to dev value)
- `DATABASE_URL` — SQLite path (defaults to `sqlite:////app/data/kanban.db`)
