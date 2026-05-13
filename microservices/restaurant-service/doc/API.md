# Restaurant Service — API

Contrato API para el microservicio Restaurantes. Cubre CRUD de restaurantes y productos, filtros y respuestas para consumo por frontend y otros microservicios.

## Autenticación
- Todos los endpoint (excepto `OPTIONS`) requieren header `x-service-token`.validado por middleware global en `app/main.py`. Si no coincide, retorna `403 Forbidden`.
- Endpoints de escritura requieren JWT con rol `admin` (dependencia `require_admin_role`). Cualquier otro rol devuelve `403`.

## Base URL
```
/api/v1
```

## Modelos

### Restaurante
| Campo | Tipo | Requerido | Notas |
|-------|------|----------|-------|
| id | UUID | auto | |
| nombre | string | sí | min=1, max=255 |
| descripcion | string | no | max=1000 |
| direccion | string | sí | min=1, max=500 |
| categoria | string | sí | min=1, max=100 |
| imagen_url | string | no | max=500 |
| is_active | bool | auto | |
| created_at | datetime | auto | |
| updated_at | datetime | auto | |

### Producto
| Campo | Tipo | Requerido | Notas |
|-------|------|----------|-------|
| id | UUID | auto | |
| restaurante_id | UUID | auto | |
| nombre | string | sí | min=1, max=255 |
| descripcion | string | no | max=1000 |
| precio | Decimal | sí | >0, 2 decimales |
| disponible | bool | auto | default=true |
| created_at | datetime | auto | |
| updated_at | datetime | auto | |

---

## Endpoints HTTP

### Restaurantes

#### 1) Crear restaurante
- **POST** `/api/v1/restaurants`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Body**:
```json
{
  "nombre": "string",
  "descripcion": "string?",
  "direccion": "string",
  "categoria": "string",
  "imagen_url": "string?"
}
```
- **Respuesta**: `201 Created` + `RestauranteResponse`

#### 2) Listar restaurantes
- **GET** `/api/v1/restaurants`
- **Auth**: `x-service-token` público
- **Query params**:
|Param|Type|Default|
|-----|-----|-------|
|categoria|string|null|
|is_active|bool|true|
|q|string|null|búsqueda por nombre/descripcion|
|limit|int|50|max=100|
|offset|int|0|
- **Respuesta**:
```json
{
  "items": [...RestauranteLista],
  "total": int,
  "limit": int,
  "offset": int
}
```

#### 3) Obtener restaurante por ID
- **GET** `/api/v1/restaurants/{restaurante_id}`
- **Auth**: `x-service-token`
- **Query params**:
|Param|Type|Default|
|-----|-----|-------|
|include_unavailable|bool|false|si false, filtra productos no disponibles|
- **Respuesta**: `RestauranteDetalle` (incluye array productos)

#### 4) Actualizar restaurante
- **PATCH** `/api/v1/restaurants/{restaurante_id}`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Body**: `RestauranteUpdate` (campos opcionales)
- **Respuesta**: `200 OK` + `RestauranteResponse`

#### 5) Activar restaurante
- **POST** `/api/v1/restaurants/{restaurante_id}/activate`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Respuesta**: `200 OK` + `RestauranteResponse` (isActive=true)

#### 6) Desactivar restaurante
- **POST** `/api/v1/restaurants/{restaurante_id}/deactivate`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Respuesta**: `200 OK` + `RestauranteResponse` (isActive=false)

---

### Productos

#### 7) Crear producto
- **POST** `/api/v1/restaurants/{restaurante_id}/products`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Body**:
```json
{
  "nombre": "string",
  "descripcion": "string?",
  "precio": "decimal",
  "disponible": true
}
```
- **Respuesta**: `201 Created` + `ProductoResponse`

#### 8) Listar productos por restaurante
- **GET** `/api/v1/restaurants/{restaurante_id}/products`
- **Auth**: `x-service-token`
- **Query params**:
|Param|Type|Default|
|-----|-----|-------|
|disponible|bool|null|
|limit|int|100|max=500|
|offset|int|0|
- **Respuesta**:
```json
{
  "items": [...ProductoResponse],
  "total": int,
  "limit": int,
  "offset": int
}
```

#### 9) Obtener producto por ID
- **GET** `/api/v1/restaurants/products/{producto_id}`
- **Auth**: `x-service-token`
- **Respuesta**: `ProductoResponse`

#### 10) Actualizar producto
- **PATCH** `/api/v1/restaurants/products/{producto_id}`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Body**: `ProductoUpdate`
- **Respuesta**: `200 OK` + `ProductoResponse`

#### 11) Eliminar producto (soft-delete)
- **DELETE** `/api/v1/restaurants/products/{producto_id}`
- **Auth**: `x-service-token` + JWT rol `admin`
- **Respuesta**: `204 No Content` (internamente `disponible=false`)

#### 12) Validar productos batch
- **POST** `/api/v1/restaurants/products/validate-batch`
- **Auth**: `x-service-token` (servicios internos)
- **Body**:
```json
{
  "items": [
    { "producto_id": "uuid", "precio_unit": "decimal" }
  ]
}
```
- **Respuesta**:
```json
{
  "items": [
    {
      "producto_id": "uuid",
      "ok": bool,
      "servidor_precio": "decimal?",
      "nombre": "string?",
      "disponible": "bool?",
      "error": "string?"
    }
  ]
}
```

---

### Health

#### 13) Health check
- **GET** `/health`
- **Auth**: none
- **Respuesta**:
```json
{
  "status": "healthy",
  "service": "restaurant-service",
  "version": "1.0.0"
}
```

---

## Gotchas

1. **Prefijo real**: `/api/v1` + router_mount (`/restaurants`) = `/api/v1/restaurants`.
2. **Soft-delete**: DELETE en productos marca `disponible=false`, no elimina físicamente.
3. **Activos por defecto**: `GET /restaurants` filtra `is_active=true`. Pasar `is_active=false` para ver inactivos.
4. **Token service**: middleware en `app/main.py` rechaza requests sin `x-service-token`.
5. **Rol admin**: cualquier rol distinto de `admin` en JWT devuelve `403` en endpoints protegidos.