from contextvars import ContextVar
import httpx
from typing import Dict, Any, List
from mirascope import llm
from app.config import settings

MAX_ITEMS = 10
_AUTH_HEADER: ContextVar[str | None] = ContextVar("auth_header", default=None)

def set_auth_header(value: str | None) -> None:
    _AUTH_HEADER.set(value)

def _get_auth_header() -> str | None:
    return _AUTH_HEADER.get()

def _get_headers() -> Dict[str, str]:
    headers = {"x-service-token": settings.SERVICE_TOKEN}
    auth_header = _get_auth_header()
    if auth_header:
        headers["Authorization"] = auth_header
    return headers

@llm.tool
async def get_active_orders() -> Dict[str, Any]:
    """Consulta los pedidos activos (pendientes) actualmente en el sistema."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{settings.ORDER_SERVICE_URL}/orders/active?estado=pendiente&limit={MAX_ITEMS}&offset=0",
                headers=_get_headers()
            )
            response.raise_for_status()
            data = response.json()
            orders = data.get("data", data) if isinstance(data, dict) else data
            if not isinstance(orders, list):
                orders = [orders]
            simplified = [
                {"id": o.get("id"), "restauranteId": o.get("restauranteId"), "total": o.get("total")}
                for o in orders[:MAX_ITEMS]
            ]
            total = data.get("pagination", {}).get("total", len(orders)) if isinstance(data, dict) else len(orders)
            return {"total_pedidos": total, "items": simplified}
        except Exception as e:
            return {"error": f"No se pudieron consultar los pedidos activos: {str(e)}"}

@llm.tool
async def get_available_deliverers() -> Dict[str, Any]:
    """Consulta los perfiles de los repartidores que están actualmente disponibles."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{settings.USER_SERVICE_URL}/api/profiles?tipo=repartidor&isActive=true&offset=0&limit={MAX_ITEMS}",
                headers=_get_headers()
            )
            response.raise_for_status()
            data = response.json()
            deliverers = data.get("items", data) if isinstance(data, dict) else data
            if not isinstance(deliverers, list):
                deliverers = [deliverers]
            simplified = [
                {
                    "id": d.get("id"),
                    "nombre": d.get("nombre"),
                    "telefono": d.get("telefono"),
                    "direccion": d.get("direccion"),
                    "disponible": d.get("disponible"),
                    "activo": d.get("isActive"),
                }
                for d in deliverers[:MAX_ITEMS]
            ]
            total = data.get("total", len(deliverers)) if isinstance(data, dict) else len(deliverers)
            return {"total_disponibles": total, "items": simplified}
        except Exception as e:
             return {"error": f"No se pudieron consultar los repartidores disponibles: {str(e)}"}

@llm.tool
async def get_top_restaurants() -> Dict[str, Any]:
    """Consulta la lista de los restaurantes activos actualmente."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{settings.RESTAURANT_SERVICE_URL}/restaurants", headers=_get_headers())
            response.raise_for_status()
            data = response.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            if not isinstance(items, list):
                items = [items]
            active_items = [r for r in items if r.get("is_active") is True]
            simplified = [
                {"id": r.get("id"), "nombre": r.get("nombre")}
                for r in active_items[:MAX_ITEMS]
            ]
            return {"total_activos": len(active_items), "items": simplified}
        except Exception as e:
             return {"error": f"No se pudieron consultar los restaurantes: {str(e)}"}

@llm.tool
async def get_revenue_by_restaurant() -> Dict[str, Any]:
    """Calcula y obtiene los ingresos totales agrupados por cada restaurante a partir de los pedidos entregados."""
    async with httpx.AsyncClient(timeout=10.0) as client:
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
            top_revenue = sorted_revenue[:MAX_ITEMS]
            formatted = [{"restauranteId": k, "ingresos": v} for k, v in top_revenue]
            
            return {"total_restaurantes": len(revenue_map), "items": formatted}
        except Exception as e:
            return {"error": f"Error al calcular los ingresos: {str(e)}"}

@llm.tool
async def get_platform_stats() -> Dict[str, Any]:
    """Obtiene unas estadisticas globales e ingresos del dia combinando ventas, pedidos activos, restaurantes activos y repartidores disponibles."""
    # Run the previous tools in sequence safely 
    try:
        active_orders = await get_active_orders()
        available_deliverers = await get_available_deliverers()
        restaurants = await get_top_restaurants()
        revenue = await get_revenue_by_restaurant()
        
        return {
            "pedidos_activos": active_orders,
            "repartidores_disponibles": available_deliverers,
            "restaurantes_activos": restaurants,
            "ingresos_agrupados": revenue
        }
    except Exception as e:
        return {"error": f"Error compilando estadisticas: {str(e)}"}
