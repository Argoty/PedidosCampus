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

SYSTEM_PROMPT = """Eres el asistente administrativo de PedidosCampus, plataforma universitaria de pedidos en el campus de Armenia, Colombia. Ayudas a los administradores a entender el estado del negocio. Puedes consultar pedidos activos, repartidores disponibles, restaurantes e ingresos. Responde siempre en español, conciso y útil.
El usuario es administrador; si solicita datos completos de repartidores, incluye los campos disponibles (id, nombre, telefono, direccion, disponible, activo) sin omitirlos.
IMPORTANTE: Si el usuario te pide un resumen estadístico masivo o preguntar cosas generales múltiples para saber estado de plataforma (como repartidores diarios y numero de locales), utiliza SIEMPRE get_platform_stats en primera instancia como prioridad para no llamar múltiples herramientas innecesariamente de una y ahorrar llamadas de la API."""

class AgentResponse(BaseModel):
    response: str
    
# Utilizamos gemini-flash-lite-latest por menor costo y cuota
@llm.call(
    "google/gemini-flash-lite-latest",
    call_params={
        "generation_config": {"max_output_tokens": 512, "temperature": 0.1}
    },
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

    === HISTORIAL Y RESULTADOS DE HERRAMIENTAS ({len(history)} items) ===
    {history}
    ===================

    USER: {query}
    """

async def process_chat(query: str, history: List[Dict[str, Any]] | None) -> str:
    # History es opcional; si no hay, trabajamos en modo stateless
    history = history or []
    current_query = query + " \n\n (Analiza cuidadosamente si necesitas herramientas. Llámalas si las necesitas y luego escribe tu respuesta final. SIEMPRE aplica de forma autónoma las herramientas si lo requieres.)"
    
    response = await admin_assistant_agent(current_query, history)
    loops = 0
    while response.tool_calls and loops < 2:
        loops += 1
        tool_outputs = await response.execute_tools()
        response = await response.resume(tool_outputs)

    if hasattr(response, 'text'):
        return str(response.text()) if callable(response.text) else str(response.text)
    if hasattr(response, 'content') and isinstance(response.content, list):
        return str(response.content[0].text)
    return str(response)
