from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth_profile import router as auth_profile_router
from app.api.routes.health import router as health_router
from app.api.routes.hubert import router as hubert_router
from app.api.routes.imports import router as imports_router
from app.api.routes.contracts import router as contracts_router
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()

app = FastAPI(
    title="BillboardHub API",
    version="0.1.0",
    description="Backend API for BillboardHub contracts and AI workflows.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_profile_router)
app.include_router(imports_router)
# Some proxies / clients use an /api prefix; mirror import routes there too.
app.include_router(imports_router, prefix="/api", include_in_schema=False)
app.include_router(hubert_router)
app.include_router(contracts_router)
app.include_router(contracts_router, prefix="/api", include_in_schema=False)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "billboardhub-api", "status": "ok"}
