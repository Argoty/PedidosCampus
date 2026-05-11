from typing import Any, List, Dict
import json
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

def _format_names(items: List[Dict[str, Any]], key: str) -> str:
    values = [str(item.get(key)) for item in items if item.get(key)]
    return ", ".join(values) if values else "Sin datos"

def _format_pairs(items: List[Dict[str, Any]], key: str, value: str) -> str:
    pairs = [f"{item.get(key)}: {item.get(value)}" for item in items if item.get(key) is not None]
    return "; ".join(pairs) if pairs else "Sin datos"

def _coerce_tool_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value

def _build_tool_response(query: str, tool_results: Dict[str, Any]) -> str:
    lines: List[str] = []

    def append_restaurants(data: Any) -> None:
        if not isinstance(data, dict):
            return
        if data.get("error"):
            lines.append(f"Restaurantes activos: {data.get('error')}")
            return
        total = data.get("total_activos")
        items = data.get("items", [])
        names = _format_names(items, "nombre")
        lines.append(f"Restaurantes activos: {total}. Nombres: {names}.")

    def append_deliverers(data: Any) -> None:
        if not isinstance(data, dict):
            return
        if data.get("error"):
            lines.append(f"Repartidores disponibles: {data.get('error')}")
            return
        total = data.get("total_disponibles")
        items = data.get("items", [])
        names = _format_names(items, "nombre")
        lines.append(f"Repartidores disponibles: {total}. Nombres: {names}.")

    def append_orders(data: Any) -> None:
        if not isinstance(data, dict):
            return
        if data.get("error"):
            lines.append(f"Pedidos activos: {data.get('error')}")
            return
        total = data.get("total_pedidos")
        items = data.get("items", [])
        ids = _format_names(items, "id")
        lines.append(f"Pedidos activos: {total}. IDs: {ids}.")

    def append_revenue(data: Any) -> None:
        if not isinstance(data, dict):
            return
        if data.get("error"):
            lines.append(f"Ingresos por restaurante: {data.get('error')}")
            return
        total = data.get("total_restaurantes")
        items = data.get("items", [])
        pairs = _format_pairs(items, "restauranteId", "ingresos")
        lines.append(f"Ingresos por restaurante (top): {pairs}. Total restaurantes: {total}.")

    if "get_platform_stats" in tool_results and isinstance(tool_results.get("get_platform_stats"), dict):
        stats = tool_results.get("get_platform_stats")
        append_orders(stats.get("pedidos_activos"))
        append_deliverers(stats.get("repartidores_disponibles"))
        append_restaurants(stats.get("restaurantes_activos"))
        append_revenue(stats.get("ingresos_agrupados"))
    else:
        append_orders(tool_results.get("get_active_orders"))
        append_deliverers(tool_results.get("get_available_deliverers"))
        append_restaurants(tool_results.get("get_top_restaurants"))
        append_revenue(tool_results.get("get_revenue_by_restaurant"))

    if not lines:
        return f"No pude obtener datos para: {query}. Resumen tools: {tool_results}"
    return "\n".join(lines)

async def process_chat(query: str, history: List[Dict[str, Any]] | None) -> str:
    # History es opcional; si no hay, trabajamos en modo stateless
    history = history or []
    current_query = query + " \n\n (Analiza cuidadosamente si necesitas herramientas. Llámalas si las necesitas y luego escribe tu respuesta final. SIEMPRE aplica de forma autónoma las herramientas si lo requieres.)"

    tool_results: Dict[str, Any] = {}

    response = await admin_assistant_agent(current_query, history)

    if response.tool_calls:
        tool_outputs = await response.execute_tools()
        if not isinstance(tool_outputs, list):
            tool_outputs = [tool_outputs]
        for output in tool_outputs:
            name = getattr(output, "name", "unknown_tool")
            error = getattr(output, "error", None)
            if error:
                tool_results[name] = {"error": str(error)}
                continue
            raw_value = getattr(output, "result", None)
            if raw_value is None:
                raw_value = getattr(output, "value", None)
            if raw_value is None:
                raw_value = output
            tool_results[name] = _coerce_tool_value(raw_value)
            history.append({"role": "user", "parts": [{"text": f"ToolResult {name}: {tool_results[name]}"}]})
        return _build_tool_response(query, tool_results)

    if hasattr(response, 'text'):
        return str(response.text()) if callable(response.text) else str(response.text)
    if hasattr(response, 'content') and isinstance(response.content, list):
        return str(response.content[0].text)
    return str(response)
