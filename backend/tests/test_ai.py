from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.main import app
from backend.models import Base
from backend.seed import seed_db

client = TestClient(app)


# ---------- helpers ----------

def _make_completion(content: str):
    choice = MagicMock()
    choice.message.content = content
    completion = MagicMock()
    completion.choices = [choice]
    return completion


@pytest.fixture
def db_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    with TestSession() as db:
        seed_db(db)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        c.post("/api/auth/login", json={"username": "user", "password": "password"})
        yield c
    app.dependency_overrides.clear()


# ---------- ai.py unit tests ----------

@pytest.mark.asyncio
async def test_chat_calls_correct_model_and_base_url():
    """ai.chat() uses the configured model and OpenRouter base URL."""
    from backend.ai import MODEL, BASE_URL, chat

    mock_create = AsyncMock(return_value=_make_completion("4"))

    with patch("backend.ai.get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.chat.completions.create = mock_create
        mock_get_client.return_value = mock_client

        result = await chat([{"role": "user", "content": "What is 2+2?"}])

    assert result == "4"
    mock_create.assert_awaited_once()
    call_kwargs = mock_create.call_args.kwargs
    assert call_kwargs["model"] == MODEL
    assert MODEL == "openai/gpt-oss-120b"
    assert BASE_URL == "https://openrouter.ai/api/v1"


@pytest.mark.asyncio
async def test_chat_reads_api_key_from_environment(monkeypatch):
    """get_client() picks up OPENROUTER_API_KEY from the environment."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-123")
    from backend import ai

    with patch("backend.ai.AsyncOpenAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        ai.get_client()

    mock_cls.assert_called_once_with(api_key="test-key-123", base_url=ai.BASE_URL)


def test_ping_endpoint_returns_reply():
    """GET /api/ai/ping returns a JSON object with a 'reply' key."""
    with patch("backend.routers.ai.chat", new=AsyncMock(return_value="4")):
        response = client.get("/api/ai/ping")
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "4" in data["reply"]


# ---------- POST /api/ai/chat tests ----------

def test_chat_requires_auth():
    with TestClient(app) as c:
        r = c.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 401


def test_chat_applies_board_updates(db_client):
    board_data = db_client.get("/api/board").json()
    backlog_id = board_data["columns"][0]["id"]

    mock_resp = {
        "message": "Done! Added a card.",
        "board_updates": [
            {"id": None, "column_id": backlog_id, "title": "AI card", "details": "from AI", "delete": False}
        ],
    }
    with patch("backend.routers.ai.chat_json", new=AsyncMock(return_value=mock_resp)):
        r = db_client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Add a card"}]})

    assert r.status_code == 200
    data = r.json()
    assert data["message"] == "Done! Added a card."
    assert len(data["board_updates"]) == 1

    board2 = db_client.get("/api/board").json()
    titles = [c["title"] for c in board2["cards"].values()]
    assert "AI card" in titles


def test_chat_no_board_updates_leaves_db_unchanged(db_client):
    before = db_client.get("/api/board").json()

    mock_resp = {"message": "No changes needed.", "board_updates": []}
    with patch("backend.routers.ai.chat_json", new=AsyncMock(return_value=mock_resp)):
        r = db_client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "What's on the board?"}]})

    assert r.status_code == 200
    assert r.json()["message"] == "No changes needed."
    assert db_client.get("/api/board").json() == before


def test_chat_malformed_response_returns_500(db_client):
    with patch("backend.routers.ai.chat_json", new=AsyncMock(return_value={"not_message": True})):
        r = db_client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 500
