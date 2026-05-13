import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.auth import router as auth_router
from backend.database import SessionLocal, create_tables
from backend.routers.ai import router as ai_router
from backend.routers.board import router as board_router
from backend.routers.boards import router as boards_router
from backend.routers.checklist import router as checklist_router
from backend.routers.comments import router as comments_router
from backend.routers.labels import router as labels_router
from backend.routers.members import router as members_router
from backend.seed import seed_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    with SessionLocal() as db:
        seed_db(db)
    yield


app = FastAPI(lifespan=lifespan)
for r in (
    auth_router,
    boards_router,
    labels_router,
    comments_router,
    members_router,
    checklist_router,
    board_router,
    ai_router,
):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}


static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
