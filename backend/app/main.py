from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1.router import api_router
from app.core.init_db import _ensure_schema_columns


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure database schema and migrations are verified on server startup."""
    _ensure_schema_columns()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "PharmacyGuard API — Hospital pharmacy prescription-verification prototype. "
        "Deterministic rule-based advisory engine. Synthetic demonstration only."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Cross-Origin Request configuration for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Optional: Mount compiled frontend static assets for unified production deployment
from pathlib import Path
from fastapi import Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    assets_dir = _FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static_assets")

    @app.get("/favicon.png", include_in_schema=False)
    def favicon():
        fav_path = _FRONTEND_DIST / "favicon.png"
        if fav_path.is_file():
            return FileResponse(fav_path)
        return None

    @app.get("/logo.png", include_in_schema=False)
    def logo():
        logo_path = _FRONTEND_DIST / "logo.png"
        if logo_path.is_file():
            return FileResponse(logo_path)
        return None


@app.get("/")
def root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept and _FRONTEND_DIST.is_dir():
        index_file = _FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "engine": "deterministic_rule_based",
        "status": "online",
        "advisory": settings.SYSTEM_DISCLAIMER,
        "docs": "/docs",
    }


# Fallback for client-side HTML5 history navigation in production unified mode
if _FRONTEND_DIST.is_dir():
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(request: Request, full_path: str):
        accept = request.headers.get("accept", "")
        # If client is requesting an HTML page and not an API call
        if "text/html" in accept and not full_path.startswith("api/"):
            index_file = _FRONTEND_DIST / "index.html"
            if index_file.is_file():
                return FileResponse(index_file)
        return {
            "error": "Not Found",
            "path": full_path,
        }

