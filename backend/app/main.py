from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "PharmacyGuard API — Hospital pharmacy prescription-verification prototype. "
        "Deterministic rule-based advisory engine. Synthetic demonstration only."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
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


@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "engine": "deterministic_rule_based",
        "status": "online",
        "advisory": settings.SYSTEM_DISCLAIMER,
        "docs": "/docs",
    }
