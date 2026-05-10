# ── Stage 1: frontend build ───────────────────────────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: backend ───────────────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS backend

WORKDIR /app

# Install Python dependencies via uv
COPY backend/pyproject.toml ./
RUN uv sync --no-install-project

# Copy backend source
COPY backend/ ./backend/

# Copy Next.js static export from frontend-build stage
COPY --from=frontend-build /app/out/ ./static/

# Data directory for SQLite (mounted as a volume at runtime)
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
