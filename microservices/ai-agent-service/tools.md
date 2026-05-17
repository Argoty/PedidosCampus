# Documentacion de Herramientas (Tools) del IA Agent Service

Este documento detalla las tools disponibles, sus endpoints y el formato de respuesta que el agente consume.

## Optimizacion para capa gratuita

Las tools retornan datos comprimidos y con limite de items para evitar exceder los limites de contexto de Gemini.

---

## Listado de Herramientas (Tools) Activas

### 1. `get_active_orders()`
- **Servicio:** `ORDER_SERVICE_URL`
- **Endpoint:** `/orders/active?estado=pendiente&limit=10&offset=0`
- **Uso:** pedidos activos (pendientes)
- **Respuesta:** `{"total_pedidos": N, "items": [{"id": "...", "restauranteId": "...", "total": 15.5}]}`

### 2. `get_available_deliverers()`
- **Servicio:** `USER_SERVICE_URL`
- **Endpoint:** `/api/profiles?tipo=repartidor&isActive=true&offset=0&limit=10`
- **Uso:** repartidores con datos completos
- **Respuesta:** `{"total_disponibles": N, "items": [{"id": "...", "nombre": "...", "telefono": "...", "direccion": "...", "disponible": true, "activo": true}]}`

### 3. `get_top_restaurants()`
- **Servicio:** `RESTAURANT_SERVICE_URL`
- **Endpoint:** `/restaurants?is_active=true&limit=10&offset=0`
- **Uso:** restaurantes activos (info completa)
- **Respuesta:** `{"total_activos": N, "items": [{"id": "...", "nombre": "...", "descripcion": "...", "direccion": "...", "categoria": "...", "imagen_url": "...", "activo": true}]}`

### 4. `get_revenue_by_restaurant()`
- **Servicio:** `ORDER_SERVICE_URL`
- **Endpoint:** `/orders?estado=entregado`
- **Uso:** ingresos por restaurante
- **Respuesta:** `{"total_restaurantes": N, "items": [{"restauranteId": "xyz", "ingresos": 152000.0}]}`

### 5. `get_deliverer_stats()`
- **Servicio:** `ORDER_SERVICE_URL` + `USER_SERVICE_URL`
- **Uso:** pedidos e ingresos por repartidor (con perfil)
- **Respuesta:** `{"total_repartidores": N, "total_pedidos_entregados": M, "limitado": bool, "items": [{"repartidorId": "...", "pedidos": 4, "ingresos": 171208.0, "nombre": "...", "telefono": "...", "direccion": "..."}]}`

### 6. `get_delivered_orders()`
- **Servicio:** `ORDER_SERVICE_URL` + `USER_SERVICE_URL`
- **Uso:** pedidos entregados con datos del repartidor
- **Respuesta:** `{"total_entregados": N, "items": [{"id": "...", "repartidorId": "...", "nombre": "...", "telefono": "...", "direccion": "...", "total": 12.5, "estado": "entregado"}]}`

### 7. `get_restaurant_products(restaurant_id)`
- **Servicio:** `RESTAURANT_SERVICE_URL`
- **Endpoint:** `/restaurants/{id}/products?limit=100&offset=0`
- **Uso:** productos y precios de un restaurante
- **Respuesta:** `{"restauranteId": "...", "total_productos": N, "items": [{"id": "...", "nombre": "...", "descripcion": "...", "precio": 12.0, "disponible": true}]}`

### 8. `get_restaurants_with_products()`
- **Servicio:** `RESTAURANT_SERVICE_URL`
- **Endpoint:** `/restaurants?is_active=true&limit=10&offset=0`
- **Uso:** restaurantes con su menu (limitado)
- **Respuesta:** `{"total_restaurantes": N, "items": [{"id": "...", "nombre": "...", "productos": [...] }]}`

### 9. `get_top_products_by_restaurant()`
- **Servicio:** `ORDER_SERVICE_URL` + `RESTAURANT_SERVICE_URL`
- **Uso:** productos mas vendidos por restaurante (segun pedidos entregados)
- **Respuesta:** `{"total_restaurantes": N, "total_pedidos_entregados": M, "limitado": bool, "items": [{"restauranteId": "...", "restauranteNombre": "...", "productos": [{"productoId": "...", "nombre": "...", "cantidad": 5, "ingresos": 120.0}]}]}`

### 10. `get_platform_stats()`
- **Servicio:** agrega las tools basicas
- **Uso:** resumen global compacto
