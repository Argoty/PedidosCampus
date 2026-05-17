from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    message: str = Field(..., description="El mensaje o query para el agente administrador")
    session_id: str = Field(..., description="Identificador de sesion para trazabilidad")

class ChatResponse(BaseModel):
    response: str = Field(..., description="La respuesta del asistente generada por el LLM")
    session_id: str = Field(..., description="El identificador de la sesión de vuelta")

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "ai-agent-service"
