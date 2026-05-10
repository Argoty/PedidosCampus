from fastapi import FastAPI
from app.routes.ai_routes import router as ai_router
import logging

# Configure basic logging logic
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-agent-service")

app = FastAPI(
    title="PedidosCampus AI Agent Service",
    description="Microservicio administrado de IA usando Gemini y Mirascope para administradores",
    version="1.0.0"
)

# Routes inclusion
app.include_router(ai_router, prefix="/ai")

@app.on_event("startup")
async def startup_event():
    logger.info("AI Agent Service is initializing...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("AI Agent Service is shutting down...")
