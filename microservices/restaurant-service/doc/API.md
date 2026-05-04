# Restaurant Service — API

Contrato API para el microservicio Restaurantes. Cubre CRUD de restaurantes y productos, filtros y respuestas para consumo por frontend y otros microservicios.

## Autenticación
- Todos los endpoints (excepto `OPTIONS`) requieren el header `x-service-token` validado por middleware global (`app/main.py`). Si no coincide, retorna `403 Forbidden`.
- Los endpoints de creación/edición/eliminación requieren además un JWT con rol `admin` (evaluado mediante dependencia `require_admin_role`).

## Modelos (resumen)
- **Restaurante**: id, nombre, descripcion, direccion, categoria, imagenUrl, isActive, createdAt, updatedAt
- **Producto**: id, restauranteId, nombre, descripcion, precio, disponible, createdAt, updatedAt

---

## Endpoints HTTP

> Nota: Las rutas base están definidas por el router local. En la aplicación actual, todos los endpoints de `restaurantes` y `productos` caen bajo el prefijo `/restaurants`.

### 1) Crear restaurante
- `POST /restaurants`
- **Roles**: admin (`require_admin_role`)
- **Body**: `RestauranteCreate`
  ```json
  {
    "nombre": "string",
    "descripcion": "string?",
    "direccion": "string",
    "categoria": "string",
    "imagenUrl": "string?"
  }
  ```
- **Respuesta**: `201 Created` (Devuelve el recurso creado)

### 2) Listar restaurantes
- `GET /restaurants`
- **Roles**: Público (pero requiere `x-service-token`)
- **Filtros (Query params)**:
  - `categoria` (string, opcional)
  - `is_active` (bool, default=true)
  - `q` (string, opcional): Búsqueda por nombre o descripción
  - `limit` (int, default=50, max=100)
  - `offset` (int, default=0)
- **Respuesta**: Diccionario paginado `{"items": [...], "total": int, "limit": int, "offset": int}`

### 3) Obtener restaurante por id (incluye menú)
- `GET /restaurants/{restaurante_id}`
- **Filtros (Query params)**:
  - `include_unavailable` (bool, default=false): Si es false, sólo incluye productos disponibles.
- **Respuesta**: Objeto Restaurante detallado + array de productos.

### 4) Actualizar restaurante
- `PATCH /restaurants/{restaurante_id}`
- **Roles**: admin (`require_admin_role`)
- **Body**: `RestauranteUpdate` (campos parciales)
- **Respuesta**: `200 OK` con recurso actualizado

### 5) Activar / Desactivar restaurante
- `POST /restaurants/{restaurante_id}/activate`
- `POST /restaurants/{restaurante_id}/deactivate`
- **Roles**: admin (`require_admin_role`)
- **Respuesta**: `200 OK` con recurso modificado (`isActive` a `True` o `False` correspondientemente)

---

### 6) CRUD Productos

> ¡Importante!: Por la configuración actual del enrutador (`api_router.include_router(products.router, prefix="/restaurants")`), todas las rutas de productos inician con `/restaurants`.

- **Crear producto**: `POST /restaurants/{restaurante_id}/products`
  - **Roles**: admin (`require_admin_role`)
  - **Body**: `ProductoCreate`
- **Listar productos de un restaurante**: `GET /restaurants/{restaurante_id}/products`
  - **Filtros (Query params)**: `disponible` (bool, opcional), `limit` (default=100), `offset` (default=0)
- **Obtener producto**: `GET /restaurants/products/{producto_id}`
- **Actualizar producto**: `PATCH /restaurants/products/{producto_id}`
  - **Roles**: admin (`require_admin_role`)
- **Eliminar producto (soft-delete)**: `DELETE /restaurants/products/{producto_id}`
  - **Roles**: admin (`require_admin_role`)
  - **Efecto**: `204 No Content` (internamente pasa `disponible=False`).

---

### 7) Integración con order-service (Validación Batch)
- `POST /restaurants/products/validate-batch`
- **Body**: `ProductoValidacionRequest`
  ```json
  {
    "items": [
      { "producto_id": "uuid", "precio_unitario": 10.5 }
    ]
  }
  ```
- **Respuesta**: `ProductoValidacionResponse`
  - Este endpoint permite validar atómicamente los items del pedido y devolver discrepancias (nombre, precio, disponibilidad y estado global `ok`).

### 8) Health Check
- `GET /health`
- **Respuesta**: `{"status": "healthy", "service": "restaurant-service", "version": "1.0.0"}`

---

## Consideraciones de Diseño y Gotchas Documentados
- **Prefijos**: El código en `app/api/v1/router.py` agrupa *todo* bajo `/restaurants`. Por lo que los endpoints independientes de productos quedan como `/restaurants/products/{id}`.
- **Autorización por Token de Servicio**: `app/main.py` define un middleware que requiere el header `x-service-token` en toda request que no sea `OPTIONS`.
- **Soft Deletes**: `DELETE` sobre productos no elimina físicamente la fila, la marca como no disponible.
- **Activos por defecto**: `GET /restaurants` filtra `is_active=True` por defecto. Si quieres ver todos, hay que pasar explícitamente `is_active=false` o sin filtrar según implementación.
