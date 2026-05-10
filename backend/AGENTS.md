# Backend

## Overview

A Python FastAPI application served via uvicorn. It serves the static Next.js export at `/` and exposes all API routes under `/api/`. Dependency management uses `uv` (`pyproject.toml`).

## File structure

```
backend/
  main.py          # FastAPI app: health route + StaticFiles mount
  pyproject.toml   # uv project: declares fastapi, uvicorn, httpx; dev deps: pytest
  static/          # Static files served at /  (placeholder HTML for Part 2;
                   # replaced by Next.js export in Part 3)
  tests/
    test_health.py # pytest unit test for GET /api/health
```

## Routes

| Method | Path          | Description                  |
|--------|---------------|------------------------------|
| GET    | /api/health   | Returns `{"status": "ok"}`   |
| GET    | /*            | Static files (Next.js / HTML)|

## Running locally (without Docker)

```bash
cd backend
uv sync
uv run uvicorn backend.main:app --reload
```

## Running tests

```bash
cd backend
uv run pytest
```

## Notes for agents

- All new API routes must be prefixed with `/api/`.
- The static files mount must remain last in `main.py` so API routes take priority.
- The SQLite database will live at `/app/data/kanban.db` (volume-mounted in Docker); access it via the async SQLAlchemy session added in Part 6.
- Never log or return the `OPENROUTER_API_KEY` environment variable.