# ── Stage 1: frontend build (placeholder for Part 2; activated in Part 3) ──────
# Uncomment in Part 3 when the frontend is ready to be built.
# FROM node:22-slim AS frontend-build
# WORKDIR /app
# COPY frontend/package*.json ./
# RUN npm ci
# COPY frontend/ ./
# RUN npm run build

# ── Stage 2: backend ───────────────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS backend

WORKDIR /app

# Install Python dependencies via uv
COPY backend/pyproject.toml ./
RUN uv sync --no-install-project --no-dev

# Copy backend source
COPY backend/ ./backend/

# Copy static files (placeholder HTML for Part 2; replaced by Next.js output in Part 3)
COPY backend/static/ ./static/

# Data directory for SQLite (mounted as a volume at runtime)
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
