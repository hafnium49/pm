from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve static files at root (Next.js export or placeholder HTML).
# In the container, main.py is at /app/backend/main.py, so ../static → /app/static.
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
