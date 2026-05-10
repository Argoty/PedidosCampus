from typing import Any, List, Dict
from mirascope import llm
from pydantic import BaseModel
import asyncio
from app.tools.agent_tools import (
    get_active_orders,
    get_available_deliverers,
    get_top_restaurants,
    get_revenue_by_restaurant,
    get_platform_stats
)

SYSTEM_PROMPT = """Eres el asistente administrativo de PedidosCampus, plataforma universitaria de pedidos en el campus de Armenia, Colombia. Ayudas a los administradores a entender el estado del negocio. Puedes consultar pedidos activos, repartidores disponibles, restaurantes e ingresos. Responde siempre en español, conciso y útil."""

class AgentResponse(BaseModel):
    response: str
    
# We use gemini-2.5-flash as requested
@llm.call(
    "google/gemini-2.5-flash",
    tools=[
        get_active_orders,
        get_available_deliverers,
        get_top_restaurants,
        get_revenue_by_restaurant,
        get_platform_stats
    ]
)
async def admin_assistant_agent(query: str, history: List[Dict[str, Any]]) -> str:
    return f"""
    SYSTEM: {SYSTEM_PROMPT}

    MESSAGES: {history}
    USER: {query}
    """

async def process_chat(query: str, history: List[Dict[str, Any]]) -> str:
    """
    Processes the chat with the LLM. Replicates the internal tool loop processing conceptually similar 
    to what was requested but using Mirascope seamless bindings.
    """
    # The provider execution might invoke tools multiple times if requested by LLM
    response = await admin_assistant_agent(query, history)
    
    # If using Mirascope tool calling, we must manually resolve tools if response.tool_calls exists.
    # Mirascope handles this for gemini normally, but just to ensure we apply the tool loop pattern:
    while response.tool_calls:
        # For simplicity, we can do one logic loop manually if desired, but in the new Mirascope 
        # auto-tool execution is easier to handle with `response.tool_calls`. Let's process them if needed.
        for tool_call in response.tool_calls:
            try:
                # Execution
                result = await tool_call.call() 
                history.append({"role": "model", "parts": [{"text": f"Llamando a {tool_call.name}"}]})
                history.append({"role": "user", "parts": [{"text": f"System/ToolResult para {tool_call.name}: {result}. (Considera esta info). Continua."}]})
            except Exception as e:
                history.append({"role": "user", "parts": [{"text": f"Error ejecutando {tool_call.name}: {str(e)}"}]})

        # Do next call with updated history
        response = await admin_assistant_agent("Por favor usa los datos de las herramientas para responder al humano finalmente.", history)
        
    if hasattr(response, 'text'):
        return str(response.text()) if callable(response.text) else str(response.text)
    elif isinstance(response.content, list):
        return str(response.content[0].text)
    return str(response.content)
