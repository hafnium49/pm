import os
from openai import AsyncOpenAI

MODEL = "openai/gpt-oss-120b"
BASE_URL = "https://openrouter.ai/api/v1"


def get_client() -> AsyncOpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    return AsyncOpenAI(api_key=api_key, base_url=BASE_URL)


async def chat(messages: list[dict]) -> str:
    client = get_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
    )
    return response.choices[0].message.content or ""
