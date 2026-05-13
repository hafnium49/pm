from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.auth import router as auth_router
from backend.routers.board import router as board_router
from backend.routers.boards import router as boards_router
from backend.routers.labels import router as labels_router
from backend.routers.comments import router as comments_router
from backend.routers.members import router as members_router
from backend.routers.checklist import router as checklist_router
from backend.routers.ai import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.database import SessionLocal, create_tables
    from backend.seed import seed_db
    create_tables()
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
app.include_router(boards_router)
app.include_router(labels_router)
app.include_router(comments_router)
app.include_router(members_router)
app.include_router(checklist_router)
app.include_router(board_router)
app.include_router(ai_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
