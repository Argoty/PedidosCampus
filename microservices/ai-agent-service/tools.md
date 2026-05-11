# Documentación de Herramientas (Tools) del IA Agent Service

Este documento detalla todas las herramientas (tools) disponibles actualmente para el agente de IA, desde dónde consumen los datos y cómo han sido optimizadas para evitar agotar las cuotas (Error 429) de la capa gratuita de Gemini API.

## Problema de la Capa Gratuita (Contexto de Optimizacion)

En la iteración original, herramientas como `get_top_restaurants` o `get_active_orders` enviaban al LLM la **respuesta JSON cruda** completa traída desde los otros microservicios. Un JSON completo de un restaurante puede ser inmenso porque contiene descripciones en texto largo, URLs de imágenes, fechas de creación (timestamps), y listas de UUIDs. 

> Cuando pides información en una misma sesión (ej. `"session_id": "admin_session_2"`), Mirascope reinyecta un historial con los diccionarios JSON del pasado. Si cada respuesta JSON pesa miles de caracteres, en solo 2 preguntas enviarás un archivo de texto gigantesco que excede astronómicamente el _Tokens Per Minute_ (TPM) permitido por Google, causando los misteriosos Timeouts/429 limits repetidos.

**Solucion aplicada:** Todas las tools ahora interceptan la respuesta JSON del Fetch, la "exprimen" y retienen unica y exclusivamente campos basicos (`id`, `nombre`, `total`). Ademas retornan un resumen con conteos y solo los primeros 10 items para evitar saturar el contexto y disparar limites 429.

---

## Listado de Herramientas (Tools) Activas

### 1. `get_active_orders()`
- **Servicio que consume:** `ORDER_SERVICE_URL` -> Endpoint: `/orders?estado=pendiente`
- **Uso:** Le permite al LLM saber cuántos y cuáles pedidos no han sido entregados o están apenas en camino.
- **Data que retorna al modelo JSON:** `{"total_pedidos": N, "items": [{"id": "...", "restauranteId": "...", "total": 15.5}]}` con maximo 10 items. Todas las fechas y menus del pedido se descartan.

### 2. `get_available_deliverers()`
- **Servicio que consume:** `USER_SERVICE_URL` -> Endpoint: `/users/profiles?tipo=repartidor&disponible=true`
- **Uso:** Le permite al administrador consultar rápidamente qué domiciliarios están listos para agarrar pedidos sin estar ocupados.
- **Data que retorna al modelo JSON:** `{"total_disponibles": N, "items": [{"nombre": "Juan", "disponible": true}]}` con maximo 10 items. IDs de la base de datos, contraseñas hash, emails y coordenadas se descartan por seguridad y peso.

### 3. `get_top_restaurants()`
- **Servicio que consume:** `RESTAURANT_SERVICE_URL` -> Endpoint: `/restaurants`
- **Uso:** Retorna la información de los restaurantes y su disponibilidad, útil para saber si hay variedad. 
- **Data que retorna al modelo JSON:** `{"total_activos": N, "items": [{"id": "...", "nombre": "Cafeteria Central"}]}` con maximo 10 items. Ignora el listado de productos gigantesco o imagenes y banners adjuntos.

### 4. `get_revenue_by_restaurant()`
- **Servicio que consume:** `ORDER_SERVICE_URL` -> Endpoint: `/orders?estado=entregado`
- **Uso:** Motor de cálculo estadístico interno. Descarga del order-service todos los pedidos que ya fueron entregados exitosamente, agarra sus precios, los suma agrupando por `restauranteId` y luego los ordena de mayor a menor.
- **Data que retorna al modelo JSON:** `{"total_restaurantes": N, "items": [{"restauranteId": "xyz", "ingresos": 152000.0}]}` con maximo 10 items. Extremadamente preciso para preguntas contables.

### 5. `get_platform_stats()`
- **Servicio que consume:** Es una macro-herramienta que llama asíncronamente a todas las 4 definidas aquí arriba.
- **Uso:** Si el gerente dice "Dame un resumen del negocio hoy" o "Haz un análisis completo de pedidos y tiendas", el agente llama a esta tool en lugar de llamar a las 4 una por una. Esto mitiga que Mirascope bombardee a Gemini con 5 idas y vueltas diferentes. Todo se condensa en un JSON global super comprimido.
