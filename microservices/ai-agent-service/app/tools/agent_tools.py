from contextvars import ContextVar
from typing import Dict, Any
import httpx
from mirascope import llm
from app.config import settings

MAX_ITEMS = 10
ORDER_PAGE_SIZE = 50
MAX_ORDER_PAGES = 4
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

async def _fetch_json(url: str) -> Any:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=_get_headers())
        response.raise_for_status()
        return response.json()

async def _fetch_paged_orders(estado: str) -> tuple[list[Dict[str, Any]], int, bool]:
    orders: list[Dict[str, Any]] = []
    total = 0
    offset = 0
    page = 0

    while page < MAX_ORDER_PAGES:
        data = await _fetch_json(
            f"{settings.ORDER_SERVICE_URL}/orders?estado={estado}&limit={ORDER_PAGE_SIZE}&offset={offset}"
        )
        items = data.get("data", data) if isinstance(data, dict) else data
        if not isinstance(items, list):
            items = [items]
        if page == 0:
            total = data.get("pagination", {}).get("total", len(items)) if isinstance(data, dict) else len(items)
        if not items:
            break
        orders.extend(items)
        if len(items) < ORDER_PAGE_SIZE:
            break
        offset += ORDER_PAGE_SIZE
        page += 1

    limited = total > 0 and len(orders) < total
    return orders, total, limited

async def _fetch_profile_names(profile_ids: list[str]) -> Dict[str, str]:
    names: Dict[str, str] = {}
    for profile_id in profile_ids:
        if not profile_id or profile_id in names:
            continue
        try:
            data = await _fetch_json(f"{settings.USER_SERVICE_URL}/api/profiles/{profile_id}")
            name = data.get("nombre") if isinstance(data, dict) else None
            if name:
                names[profile_id] = name
        except Exception:
            continue
    return names

@llm.tool
async def get_active_orders() -> Dict[str, Any]:
    """Consulta los pedidos activos (pendientes) actualmente en el sistema."""
    try:
        data = await _fetch_json(
            f"{settings.ORDER_SERVICE_URL}/orders/active?estado=pendiente&limit={MAX_ITEMS}&offset=0"
        )
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
    try:
        data = await _fetch_json(
            f"{settings.USER_SERVICE_URL}/api/profiles?tipo=repartidor&isActive=true&offset=0&limit={MAX_ITEMS}"
        )
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
    try:
        data = await _fetch_json(
            f"{settings.RESTAURANT_SERVICE_URL}/restaurants?is_active=true&limit={MAX_ITEMS}&offset=0"
        )
        items = data.get("items", data) if isinstance(data, dict) else data
        if not isinstance(items, list):
            items = [items]
        full_items = [
            {
                "id": r.get("id"),
                "nombre": r.get("nombre"),
                "descripcion": r.get("descripcion"),
                "direccion": r.get("direccion"),
                "categoria": r.get("categoria"),
                "imagen_url": r.get("imagen_url") or r.get("imagenUrl"),
                "activo": r.get("is_active"),
                "creado": r.get("created_at"),
                "actualizado": r.get("updated_at"),
            }
            for r in items[:MAX_ITEMS]
        ]
        total = data.get("total", len(items)) if isinstance(data, dict) else len(items)
        return {"total_activos": total, "items": full_items}
    except Exception as e:
        return {"error": f"No se pudieron consultar los restaurantes: {str(e)}"}

@llm.tool
async def get_revenue_by_restaurant() -> Dict[str, Any]:
    """Calcula y obtiene los ingresos totales agrupados por cada restaurante a partir de los pedidos entregados."""
    try:
        data = await _fetch_json(f"{settings.ORDER_SERVICE_URL}/orders?estado=entregado")
        orders = data.get("data", data) if isinstance(data, dict) else data
        if not isinstance(orders, list):
            orders = [orders]

        revenue_map: Dict[str, float] = {}
        for order in orders:
            rest_id = str(order.get("restauranteId", "Desconocido"))
            total = float(order.get("total", 0.0))
            revenue_map[rest_id] = revenue_map.get(rest_id, 0.0) + total

        sorted_revenue = sorted(revenue_map.items(), key=lambda item: item[1], reverse=True)
        top_revenue = sorted_revenue[:MAX_ITEMS]
        formatted = [{"restauranteId": k, "ingresos": v} for k, v in top_revenue]

        return {"total_restaurantes": len(revenue_map), "items": formatted}
    except Exception as e:
        return {"error": f"Error al calcular los ingresos: {str(e)}"}

@llm.tool
async def get_delivered_orders() -> Dict[str, Any]:
    """Lista pedidos entregados con repartidor asignado (limitado)."""
    try:
        data = await _fetch_json(
            f"{settings.ORDER_SERVICE_URL}/orders?estado=entregado&limit={MAX_ITEMS}&offset=0"
        )
        orders = data.get("data", data) if isinstance(data, dict) else data
        if not isinstance(orders, list):
            orders = [orders]

        deliverer_ids = [str(o.get("repartidorId")) for o in orders if o.get("repartidorId")]
        names = await _fetch_profile_names(deliverer_ids)

        items = [
            {
                "id": o.get("id"),
                "repartidorId": o.get("repartidorId"),
                "repartidorNombre": names.get(str(o.get("repartidorId"))),
                "total": o.get("total"),
                "estado": o.get("estado"),
                "creado": o.get("createdAt"),
            }
            for o in orders[:MAX_ITEMS]
        ]
        total = data.get("pagination", {}).get("total", len(orders)) if isinstance(data, dict) else len(orders)
        return {"total_entregados": total, "items": items}
    except Exception as e:
        return {"error": f"No se pudieron consultar los pedidos entregados: {str(e)}"}

@llm.tool
async def get_deliverer_stats() -> Dict[str, Any]:
    """Calcula ingresos y pedidos entregados por repartidor (con limite de paginado)."""
    try:
        orders, total_orders, limited = await _fetch_paged_orders("entregado")
        totals: Dict[str, Dict[str, Any]] = {}

        for order in orders:
            deliverer_id = str(order.get("repartidorId")) if order.get("repartidorId") else None
            if not deliverer_id:
                continue
            entry = totals.setdefault(deliverer_id, {"repartidorId": deliverer_id, "pedidos": 0, "ingresos": 0.0})
            entry["pedidos"] += 1
            entry["ingresos"] += float(order.get("total", 0.0))

        sorted_items = sorted(totals.values(), key=lambda item: item["ingresos"], reverse=True)
        top_items = sorted_items[:MAX_ITEMS]
        names = await _fetch_profile_names([item["repartidorId"] for item in top_items])
        for item in top_items:
            item["nombre"] = names.get(item["repartidorId"])

        return {
            "total_repartidores": len(totals),
            "total_pedidos_entregados": total_orders,
            "limitado": limited,
            "items": top_items,
        }
    except Exception as e:
        return {"error": f"No se pudieron calcular ingresos por repartidor: {str(e)}"}

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
