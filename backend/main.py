from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve static files at root (Next.js export or placeholder HTML).
# The /app/static directory is populated by the Docker build.
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
