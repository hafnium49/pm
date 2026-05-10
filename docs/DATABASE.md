# Database

SQLite file at `/app/data/kanban.db`, created automatically on first run. The `/app/data` directory is a Docker named volume so data persists across container restarts.

## Schema

### users
Stores login credentials. `hashed_password` stores a bcrypt hash. Only one user (`user`) exists in the MVP but the table supports multiple.

### boards
One board per user for the MVP. `user_id` is a foreign key to `users` with cascade delete.

### columns
Each board has ordered columns. `position` is a zero-based integer; columns are returned sorted by `position`. The five default columns (Backlog, Discovery, In Progress, Review, Done) are seeded on first run.

### cards
Each card belongs to one column. `position` is a zero-based integer within its column; cards are returned sorted by `position`. Moving a card updates its `column_id` and `position`; other cards in the affected columns are re-numbered.

## Ordering

Both `columns.position` and `cards.position` use dense integers starting at 0. On insert, the new item gets `max(position) + 1`. On move/delete, positions are compacted (gaps closed) to keep ordering simple for the frontend.

## Cascade deletes

All foreign keys use `ON DELETE CASCADE`:
- Deleting a user removes their boards, columns, and cards.
- Deleting a board removes its columns and cards.
- Deleting a column removes its cards.
