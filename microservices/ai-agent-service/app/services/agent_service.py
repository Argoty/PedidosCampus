from mirascope import llm

from app.tools.agent_tools import (
    get_active_orders,
    get_available_deliverers,
    get_top_restaurants,
    get_revenue_by_restaurant,
    get_deliverer_stats,
    get_delivered_orders,
    get_restaurant_products,
    get_restaurants_with_products,
    get_top_products_by_restaurant,
    get_platform_stats,
)

SYSTEM_PROMPT = """Eres el asistente administrativo de PedidosCampus, plataforma universitaria de pedidos en el campus de Armenia, Colombia. Ayudas a los administradores a entender el estado del negocio. Puedes consultar pedidos activos, repartidores disponibles, restaurantes e ingresos. Responde siempre en español, conciso y útil.
El usuario es administrador; si solicita datos completos de repartidores o restaurantes, incluye los campos disponibles sin omitirlos.
Si preguntan por ingresos por repartidor o pedidos entregados con repartidor, usa get_deliverer_stats o get_delivered_orders.
Si preguntan por menu/productos de restaurantes, usa get_restaurant_products o get_restaurants_with_products.
Si preguntan por productos mas vendidos por restaurante, usa get_top_products_by_restaurant.
IMPORTANTE: Si el usuario te pide un resumen estadístico masivo o preguntar cosas generales múltiples para saber estado de plataforma (como repartidores diarios y numero de locales), utiliza SIEMPRE get_platform_stats en primera instancia como prioridad para no llamar múltiples herramientas innecesariamente de una y ahorrar llamadas de la API."""

TOOL_INSTRUCTIONS = "(Analiza cuidadosamente si necesitas herramientas. Llámalas si las necesitas y luego escribe tu respuesta final. SIEMPRE aplica de forma autónoma las herramientas si lo requieres.)"
MAX_TOOL_LOOPS = 2
TOOLS = [
    get_active_orders,
    get_available_deliverers,
    get_top_restaurants,
    get_revenue_by_restaurant,
    get_deliverer_stats,
    get_delivered_orders,
    get_restaurant_products,
    get_restaurants_with_products,
    get_top_products_by_restaurant,
    get_platform_stats,
]
    
# Utilizamos gemini-flash-lite-latest por menor costo y cuota
@llm.call(
    "google/gemini-flash-lite-latest",
    call_params={"generation_config": {"max_output_tokens": 512, "temperature": 0.1}},
    tools=TOOLS,
)
async def admin_assistant_agent(query: str) -> str:
    return f"""SYSTEM: {SYSTEM_PROMPT}
USER: {query}
"""


def _response_text(response: object) -> str:
    if hasattr(response, "text"):
        return str(response.text()) if callable(response.text) else str(response.text)
    if hasattr(response, "content") and isinstance(response.content, list):
        return str(response.content[0].text)
    return str(response)

async def process_chat(query: str) -> str:
    response = await admin_assistant_agent(f"{query}\n\n{TOOL_INSTRUCTIONS}")
    for _ in range(MAX_TOOL_LOOPS):
        if not response.tool_calls:
            break
        response = await response.resume(await response.execute_tools())
    return _response_text(response)
