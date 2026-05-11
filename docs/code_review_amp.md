# Code Review — Amp

Comprehensive review of the Kanban Studio MVP after the Part 10 milestone.
Items already documented in `docs/code_review.md` and `docs/code_review_opencode.md`
(B1 CSS variable mismatch, B2 keystroke rename, B3 AI delete compaction) appear to
have been fixed; they are not repeated here. Findings are grouped by category and
ordered roughly by severity.

---

## Summary

The project meets every functional requirement in `docs/PLAN.md` Parts 1–10:
login is gated, the board persists, AI chat works end‑to‑end, and the whole
stack runs from a single Docker image. The code is small, idiomatic, and easy
to follow. Test coverage is reasonable — backend API routes, AI wrapper, and
frontend board flows are all exercised. There are no critical security holes
for a local‑only MVP, but a number of correctness, robustness, and
reproducibility issues should be addressed before this becomes a multi‑user
deployment.

---

## Bugs

### B1. Seeded `hashed_password` is dead code (LOW, but misleading)

`backend/seed.py:13-14` stores `sha256("password")` in `users.hashed_password`,
but `backend/auth.py:21,27-29` validates the login against an in‑memory
`CREDENTIALS = {"user": "password"}` dict. The DB column is never read.

This violates the principle that the schema document (`docs/DATABASE.md`)
describes — that the user is authenticated against the stored hash. A future
contributor adding a second user via the DB would silently get a 401.

**Action:** Either authenticate against `users.hashed_password` (preferred,
matches the documented schema), or drop the unused column / seeding from the
MVP and update `docs/DATABASE.md` to say so.

### B2. Generic 500 swallows real AI/network errors (LOW)

`backend/routers/ai.py:131-135` wraps the call to `chat_json` and the Pydantic
parse in a single `except Exception:` that always returns
`"AI returned an unexpected response"`. Network timeouts, OpenRouter 5xx,
missing API key, and a malformed JSON payload all produce the same message,
which makes diagnosis harder and hides real outages from operators.

**Action:** Catch `pydantic.ValidationError` (and `json.JSONDecodeError` from
`chat_json`) for "malformed response" specifically; let other exceptions
propagate or map them to a different message/status code (e.g. 502 for upstream
failures). At minimum, `logger.exception(...)` the original error.

### B3. `_apply_updates` raises `ValueError` on non‑numeric IDs (LOW)

`backend/routers/ai.py:69, 77, 100` calls `int(u.column_id)` and `int(u.id)`
without validation. If the model hallucinates a non‑numeric ID, FastAPI returns
an unhandled 500 with a stack trace. The route already tells the model that
IDs are strings, so it is plausible the model will return e.g. `"new"` or
`"backlog"`.

**Action:** Wrap each parse in a `try/except ValueError: continue`, matching
the rest of the function which silently skips invalid updates.

### B4. Optimistic move can desync if a second drag completes first (LOW)

`KanbanBoard.tsx:75-85` issues `api.moveCard` without sequencing. If a user
drags two cards in quick succession and the second response arrives before the
first, no client‑side state is corrupted (the local board was already updated
optimistically), but the *server* may apply moves out of order, producing a
final ordering that disagrees with the UI until the next refresh.

**Action:** For the MVP this is acceptable; add a follow‑up issue to either
serialize move requests or have the server return the affected column so the
client can reconcile.

### B5. Stale session is reported as a generic error (LOW)

If the session cookie expires while the page is open, every API call returns
401, the user sees "Could not load board." / "Failed to move card." toasts and
stays on the page indefinitely. They have to manually navigate to `/login`.

**Action:** In the `api.ts` wrappers, treat a 401 response as a special case
that triggers a redirect to `/login` (e.g. via a thin `apiFetch` helper).

---

## Security & Robustness

### S1. `SECRET_KEY` silently defaults to a known string

`backend/auth.py:10` falls back to `"dev-secret-do-not-use-in-prod"` when
`SECRET_KEY` is unset. Sessions signed with this key can be forged by anyone
with the source code. There is no warning at startup.

**Action:** Refuse to start (or log a loud warning) when `SECRET_KEY` is
missing, except when an explicit `ENV=dev` flag is set. At minimum, generate a
random key per process and log a warning.

### S2. `OPENROUTER_API_KEY` defaults to empty string

`backend/ai.py:9-10` passes `""` to `AsyncOpenAI` when the env var is missing.
The client then fails on first request with a confusing 401 from OpenRouter.

**Action:** Validate at startup (e.g. in `main.py` `lifespan`) that the key is
non‑empty when AI features are enabled, and fail fast with a clear message.

### S3. Login lacks rate limiting / lockout

Hardcoded credentials make this moot for the MVP, but worth noting before
real users are introduced. `itsdangerous` cookies are also unbounded in number
(no per‑user revocation).

**Action:** Out of scope for MVP; document as a follow‑up.

### S4. Container runs as root

`Dockerfile` uses the `uv` Python image without creating a non‑root user.
`/app/data` is owned by root inside the volume.

**Action:** Add a `USER` directive after `mkdir -p /app/data` and `chown` the
data directory. Optional for a local MVP.

---

## Reproducibility & Build

### R1. `uv.lock` is not used at build time

`Dockerfile:14-15` copies only `backend/pyproject.toml` and runs `uv sync
--no-install-project`. The lockfile (`backend/uv.lock`, 150 kB, present in the
repo) is ignored, so the image dependencies drift over time even when source
is unchanged.

**Action:** `COPY backend/pyproject.toml backend/uv.lock ./` and run
`uv sync --frozen --no-install-project`.

### R2. Frontend layer cache is not maximized

`Dockerfile:5` copies `package*.json` then runs `npm ci`, then copies the rest
of `frontend/`. That is correct, but the `next` build will re‑run on every
source change. Consider a Next.js standalone build to shrink the resulting
static bundle, or accept this as fine for the MVP.

### R3. `.env` is required by `docker-compose.yml` but not gitignored explicitly

`docker-compose.yml:8-9` has `env_file: - .env`. If a user clones the repo
without first creating `.env`, `docker compose up` fails with a vague error.
The repo `.gitignore` should explicitly list `.env`, and the README / start
script should warn when it is missing.

**Action:** Add `.env` to `.gitignore` (verify), and have `scripts/start.sh`
print a friendly message if the file is absent.

---

## Architecture & Code Quality

### A1. `lib/kanban.ts` still ships demo `initialData`

After Part 7 the board comes from the API; `initialData` is no longer
referenced by any component but remains exported (~70 lines of stale sample
data). It bloats the bundle and confuses readers.

**Action:** Delete `initialData` (and any fields/types only used by it).

### A2. ID type confusion at the API boundary

The DB uses integer primary keys; the JSON API returns them as strings to
match the frontend's normalized shape; the frontend then converts back to
`Number(columnId)` in `api.ts:23,46`. Each conversion is a place a bug can
hide (e.g. `Number("")` → `0`).

**Action:** Pick one representation and stick to it. The simplest fix is to
keep IDs as strings in JSON in *both* directions (Pydantic body models accept
`str`, route handlers cast once at the boundary). Removes three `Number(...)`
calls and the matching `int(u.id)` casts in the AI router.

### A3. `AuthGuard` shows a blank screen during the auth check

`frontend/src/components/AuthGuard.tsx:23` returns `null` while the `/me`
fetch is in flight. On slow connections this is a flash of nothing followed
by the board, which looks like a broken page.

**Action:** Render a small "Checking session…" placeholder, or reuse the
loader already in `KanbanBoard.tsx`.

### A4. AI prompt is brittle (no JSON Schema enforcement)

`backend/routers/ai.py:117-127` describes the response shape in prose and
relies on `response_format={"type": "json_object"}`. It does not pin the
exact schema, so the model is free to omit `board_updates` (handled), invent
extra keys (silently dropped by Pydantic), or return a `board_updates` list
where each item is a free‑form dict.

**Action:** Use OpenRouter's structured‑output / JSON Schema mode by passing
`response_format={"type": "json_schema", "json_schema": {...}}` derived from
`AIChatResponse.model_json_schema()`. This also lets you remove most of the
prose schema description.

### A5. Move semantics: AI moves always go to the end of the target column

`backend/routers/ai.py:96-98` sets `card.position = max_pos + 1` when the AI
reassigns `column_id`. The user move endpoint (`board.py:move_card`) accepts
an explicit `position`. Inconsistent behaviour means "move card X to top of
Done" cannot be expressed via the AI.

**Action:** Add an optional `position: int | None` field to `CardUpdate` and
respect it; default to "append" when missing.

### A6. `_apply_updates` mutates and commits in one go

The function does many `db.flush()` calls and a single `db.commit()` at the
end. If the second update fails, the first is rolled back — good. But there
is no transactional error reported back to the user; failed updates are just
silently dropped (`continue`). The user thinks the AI did what it said.

**Action:** Collect a list of (`update`, `error`) tuples and surface them in
the API response (e.g. `applied_updates`, `failed_updates`), so the chat
sidebar can tell the user "I couldn't find card 42".

### A7. Engine is created at import time without `pool_pre_ping`

`backend/database.py:11` creates `engine = create_engine(...)` with no
options. SQLite over a file is fine, but `connect_args={"check_same_thread":
False}` plus the default thread pool means concurrent requests share
connections. Add `pool_pre_ping=True` or switch to `NullPool` for tests.

(Tests already override the engine via `StaticPool`.)

### A8. `print`/no logging anywhere in the backend

There is no logger configured. The `lifespan` startup, AI errors, and
unexpected exceptions all rely on uvicorn's default logging. For a one‑file
demo this is acceptable; add `logging.basicConfig(level=logging.INFO)` in
`main.py` and a few targeted `logger.info`/`logger.exception` calls before
the next iteration.

### A9. Two parallel "move" implementations to keep in sync

Backend `routers/board.py:move_card` and AI `routers/ai.py:_apply_updates`
both reorder positions, with subtly different logic (the AI version always
appends; B5 above). Extracting a single `move_card_in_db(card, target_col,
position=None)` helper would make both call sites simpler and prevent drift.

---

## Tests

### T1. No test exercises the full move/reorder happy path with assertions on `position`

Current move tests check membership (card is now in the right column) but not
the resulting `position` integers. A regression where every move resets to
position 0 would still pass.

**Action:** Add a test that creates three cards, moves the middle one to
position 0, and asserts the column's `cardIds` order matches.

### T2. AI integration test is checked into the e2e suite and hits the live API

`frontend/tests/kanban.spec.ts:78-87` ("AI sidebar opens and receives a real
reply from OpenRouter") makes a live network call with a 50‑second timeout.
This will flake (or skip) without a key, and burns OpenRouter credits on
every CI run.

**Action:** Either gate behind an env var (`if (!process.env.OPENROUTER_API_KEY) test.skip(...)`)
or move it to a separate `tests/e2e-live/` directory excluded from default
runs. Mock at the network level for the default suite.

### T3. No backend test that the SQLite file is created from scratch

`PLAN.md` Part 6 lists this as a success criterion, but no automated test
verifies it (the `client` fixture uses `:memory:`).

**Action:** Add a test that points `DATA_DIR` at a fresh `tmp_path`, imports
the app, and asserts `kanban.db` exists after startup.

### T4. Frontend test names a dragged card "tabindex 0" but doesn't actually drag

`frontend/tests/kanban.spec.ts:60-65` only asserts the role/tabindex are set
up; it never simulates a drag. Drag‑and‑drop is the headline feature.

**Action:** Use Playwright's `dragTo()` to move a card and assert it ends up
in the target column — even if flaky, it is the only check that the wire
actually round‑trips.

---

## Documentation

### D1. README is missing

The repo has no top‑level `README.md`. A new contributor has no entry point;
they must read `AGENTS.md` (which is for the agent) and `docs/PLAN.md` (which
is in past tense).

**Action:** Add a 20‑line `README.md` covering: prerequisites (Docker, .env
contents), `scripts/start.sh`, default credentials, and the URL.

### D2. `docs/DATABASE.md` claims passwords are hashed

It says: "`hashed_password` stores a SHA‑256 hash". As noted in B1 above,
the column exists but is never used for authentication. Update either the
code or the docs.

### D3. `PLAN.md` Part 9 has one unchecked item

The "integration test against live OpenRouter" item is still `[ ]`. Either
mark it done (the live e2e in T2 covers this) or move to a follow‑ups list.

---

## Quick Wins (small, isolated, high ROI)

1. Pin builds with `uv.lock` (R1) — 2 line Dockerfile change.
2. Delete `initialData` from `lib/kanban.ts` (A1) — pure deletion.
3. Catch `ValueError` in `_apply_updates` (B3) — three `try/except` blocks.
4. Show a placeholder in `AuthGuard` (A3) — one JSX line.
5. Add `.env` and `kanban-data/` checks to the start script (R3) — one `if`.
6. Gate the live‑OpenRouter Playwright test (T2) — one `test.skip`.

---

## Verdict

The MVP is shippable for its stated purpose (single user, single board, local
Docker). Address B1, B2, S1, S2, R1, and A1 before extending the system to
multiple users or any internet‑facing deployment. The architecture is sound;
most remaining issues are polish, error handling, and tightening the contract
between the AI and the rest of the system.
