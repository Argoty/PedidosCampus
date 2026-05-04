from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import engine, Base
from app.api.v1.router import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created/verified")
    yield
    # Shutdown
    await engine.dispose()
    print("✅ Database connection closed")


app = FastAPI(
    title="Restaurant Service API",
    description="Microservicio de Restaurantes - PedidosCampus",
    version="1.0.0",
    lifespan=lifespan,
)

import os
_service_token = os.getenv("SERVICE_TOKEN", "")
_test_service_token = os.getenv("TEST_SERVICE_TOKEN", "test-service-token")

@app.middleware("http")
async def check_service_token(request: Request, call_next):
    # Skip token check for health check and OPTIONS
    if request.method == "OPTIONS" or request.url.path == "/health":
        return await call_next(request)
    
    if request.method != "OPTIONS":
        token = request.headers.get("x-service-token")
        # Accept either real SERVICE_TOKEN or test token
        if token != _service_token and token != _test_service_token:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)

# Include routers
app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "restaurant-service",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
    )
