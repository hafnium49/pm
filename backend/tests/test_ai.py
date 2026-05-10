from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def _make_completion(content: str):
    choice = MagicMock()
    choice.message.content = content
    completion = MagicMock()
    completion.choices = [choice]
    return completion


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
