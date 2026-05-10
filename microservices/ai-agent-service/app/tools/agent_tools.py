import httpx
from typing import Dict, Any, List
from mirascope import llm
from app.config import settings

def _get_headers() -> Dict[str, str]:
    return {"x-service-token": settings.SERVICE_TOKEN}

@llm.tool
async def get_active_orders() -> str:
    """Consulta los pedidos activos (pendientes) actualmente en el sistema."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{settings.ORDER_SERVICE_URL}/orders?estado=pendiente", headers=_get_headers())
            response.raise_for_status()
            return str(response.json())
        except Exception as e:
            return f"{{\"error\": \"No se pudieron consultar los pedidos activos: {str(e)}\"}}"

@llm.tool
async def get_available_deliverers() -> str:
    """Consulta los perfiles de los repartidores que están actualmente disponibles."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{settings.USER_SERVICE_URL}/users/profiles?tipo=repartidor&disponible=true", headers=_get_headers())
            response.raise_for_status()
            return str(response.json())
        except Exception as e:
             return f"{{\"error\": \"No se pudieron consultar los repartidores disponibles: {str(e)}\"}}"

@llm.tool
async def get_top_restaurants() -> str:
    """Consulta la lista de los restaurantes activos actualmente."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{settings.RESTAURANT_SERVICE_URL}/restaurants", headers=_get_headers())
            response.raise_for_status()
            return str(response.json())
        except Exception as e:
             return f"{{\"error\": \"No se pudieron consultar los restaurantes: {str(e)}\"}}"

@llm.tool
async def get_revenue_by_restaurant() -> str:
    """Calcula y obtiene los ingresos totales agrupados por cada restaurante a partir de los pedidos entregados."""
    async with httpx.AsyncClient() as client:
        try:
            # TODO: Pagination handling if required by the system, standard fetch for now
            response = await client.get(f"{settings.ORDER_SERVICE_URL}/orders?estado=entregado", headers=_get_headers())
            response.raise_for_status()
            
            orders = response.json()
            if isinstance(orders, dict) and "data" in orders:
                orders = orders["data"]  # In case the response wraps around a data obj

            if not isinstance(orders, list):
                orders = [orders]

            revenue_map: Dict[str, float] = {}
            for order in orders:
                rest_id = str(order.get("restauranteId", "Desconocido"))
                total = float(order.get("total", 0.0))
                revenue_map[rest_id] = revenue_map.get(rest_id, 0.0) + total
            
            # Sort for ranking
            sorted_revenue = sorted(revenue_map.items(), key=lambda item: item[1], reverse=True)
            formatted = [{"restauranteId": k, "ingresos": v} for k,v in sorted_revenue]
            
            return str(formatted)
        except Exception as e:
            return f"{{\"error\": \"Error al calcular los ingresos: {str(e)}\"}}"

@llm.tool
async def get_platform_stats() -> str:
    """Obtiene unas estadisticas globales e ingresos del dia combinando ventas, pedidos activos, restaurantes activos y repartidores disponibles."""
    # Run the previous tools in sequence safely 
    try:
        active_orders = await get_active_orders()
        available_deliverers = await get_available_deliverers()
        restaurants = await get_top_restaurants()
        revenue = await get_revenue_by_restaurant()
        
        return str({
            "pedidos_activos": active_orders,
            "repartidores_disponibles": available_deliverers,
            "restaurantes_activos": restaurants,
            "ingresos_agrupados": revenue
        })
    except Exception as e:
        return f"{{\"error\": \"Error compilando estadisticas: {str(e)}\"}}"
