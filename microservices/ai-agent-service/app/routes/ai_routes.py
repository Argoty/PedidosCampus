from fastapi import APIRouter, Depends, HTTPException, status, Header
from app.models.schema import ChatRequest, ChatResponse, HealthResponse
from app.dependencies import verify_service_token
from app.services.agent_service import process_chat
from app.tools.agent_tools import set_auth_header

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def check_health() -> HealthResponse:
    # Este endpoint NO tiene auth dependency
    return HealthResponse()

@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_service_token)], tags=["AI"])
async def ai_chat(request: ChatRequest, authorization: str | None = Header(default=None)) -> ChatResponse:
    try:
        session_id = request.session_id

        # Modo stateless: no usamos historial para evitar saturacion de contexto
        try:
            set_auth_header(authorization)
            llm_response = await process_chat(request.message)
        finally:
            set_auth_header(None)
        
        return ChatResponse(
            response=llm_response,
            session_id=session_id
        )
    except Exception as e:
        error_str = str(e)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "Quota exceeded" in error_str:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Estamos procesando muchas solicitudes o se agotó el límite la cuota gratuita (Gemini 2.0 Limit). Por favor, intenta de nuevo en unos segundos."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hubo un error procesando el mensaje: {error_str}"
        )
