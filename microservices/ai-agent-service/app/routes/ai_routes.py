from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schema import ChatRequest, ChatResponse, HealthResponse
from app.dependencies import verify_service_token
from app.services.agent_service import process_chat
from app.memory.session_memory import get_history, add_message

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def check_health() -> HealthResponse:
    # Este endpoint NO tiene auth dependency
    return HealthResponse()

@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_service_token)], tags=["AI"])
async def ai_chat(request: ChatRequest) -> ChatResponse:
    try:
        session_id = request.session_id
        
        # Obtener historial y hacer call
        history = get_history(session_id)
        
        # Ejecutar chat y obtener respuesta
        llm_response = await process_chat(request.message, history)
        
        # Añadir al historial persistente
        add_message(session_id, "user", request.message)
        add_message(session_id, "model", llm_response)
        
        return ChatResponse(
            response=llm_response,
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hubo un error procesando el mensaje: {str(e)}"
        )
