from fastapi import APIRouter
from backend.ai import chat

router = APIRouter(prefix="/api/ai")


@router.get("/ping")
async def ping():
    reply = await chat([{"role": "user", "content": "What is 2+2? Reply with just the number."}])
    return {"reply": reply}
