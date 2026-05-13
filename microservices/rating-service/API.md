# API.md — Rating Service

## Overview

Servicio de calificaciones para restaurantes y repartidores. CRUD operaciones con búsquedas por usuario, restaurante, repartidor.

Puerto: **8003**
Base URL: `http://localhost:8003`

### Swagger UI
Disponible en: `GET /swagger-ui`
OpenAPI JSON: `GET /api-docs/openapi.json`

## Autenticación

**Nota:** El código actual genera `user_id` aleatorio con `Uuid::new_v4()` (mock). Futuro: extraer del JWT.

Header opcional por ahora:
```
Authorization: Bearer <JWT_TOKEN>
```

## Error Handling

Todos errores retornan JSON con estructura:
```json
{
  "error": "error_code",
  "message": "Descripción del error"
}
```

HTTP Status codes:
- **400** — Bad Request (validación fallida)
- **401** — Unauthorized (falta JWT)
- **404** — Not Found
- **409** — Conflict (duplicate rating)
- **500** — Internal Server Error

## Health Check

### GET /health
No requiere autenticación. Verifica que servicio está operativo.

**Response 200:**
```json
{
  "status": "healthy",
  "service": "rating-service"
}
```

## Calificaciones Restaurante

### POST /ratings/restaurant
Crear calificación para un restaurante.

**Request:**
```json
{
  "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
  "restaurante_id": "650e8400-e29b-41d4-a716-446655440001",
  "estrellas": 5,
  "comentario": "Excelente comida"
}
```

**Nota:** Solo `restaurante_id` es necesario. `repartidor_id` puede ser null o omitido.

**Validaciones:**
- `estrellas`: 1-5
- `comentario`: max 500 caracteres
- `pedido_id` + `user_id` debe ser único (constraint UNIQUE en DB)

**Response 201:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440002",
  "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "450e8400-e29b-41d4-a716-446655440099",
  "restaurante_id": "650e8400-e29b-41d4-a716-446655440001",
  "repartidor_id": null,
  "estrellas": 5,
  "comentario": "Excelente comida",
  "created_at": "2026-05-04T10:30:00+00:00",
  "updated_at": "2026-05-04T10:30:00+00:00"
}
```

**Response 409 (Conflict):**
```json
{
  "error": "duplicate_rating",
  "message": "Ya existe una calificación para este pedido y usuario"
}
```

### GET /ratings/restaurant/:id
Obtener calificación por ID.

**Response 200:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440002",
  "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "450e8400-e29b-41d4-a716-446655440099",
  "restaurante_id": "650e8400-e29b-41d4-a716-446655440001",
  "repartidor_id": null,
  "estrellas": 5,
  "comentario": "Excelente comida",
  "created_at": "2026-05-04T10:30:00+00:00",
  "updated_at": "2026-05-04T10:30:00+00:00"
}
```

**Response 404:**
```json
{
  "error": "not_found",
  "message": "Calificación no encontrada"
}
```

### GET /ratings/restaurant/user/:userId
Listar todas las calificaciones de un usuario.

Query params (opcionales):
- `limit`: max 50 (default 10)
- `offset`: default 0

**Response 200:**
```json
{
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "450e8400-e29b-41d4-a716-446655440099",
      "restaurante_id": "650e8400-e29b-41d4-a716-446655440001",
      "repartidor_id": null,
      "estrellas": 5,
      "comentario": "Excelente comida",
      "created_at": "2026-05-04T10:30:00+00:00",
      "updated_at": "2026-05-04T10:30:00+00:00"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

### GET /ratings/restaurant/restaurant/:restauranteId
Listar todas las calificaciones de un restaurante.

Query params:
- `limit`: max 50 (default 10)
- `offset`: default 0

**Response 200:**
```json
{
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "450e8400-e29b-41d4-a716-446655440099",
      "restaurante_id": "650e8400-e29b-41d4-a716-446655440001",
      "repartidor_id": null,
      "estrellas": 5,
      "comentario": "Excelente comida",
      "created_at": "2026-05-04T10:30:00+00:00",
      "updated_at": "2026-05-04T10:30:00+00:00"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0
  },
  "stats": {
    "average_rating": 4.7,
    "total_ratings": 42,
    "distribution": {
      "5": 35,
      "4": 5,
      "3": 2,
      "2": 0,
      "1": 0
    }
  }
}
```

### PATCH /ratings/restaurant/:id
Actualizar calificación.

**Request:**
```json
{
  "estrellas": 4,
  "comentario": "Actualizado: la comida fue buena"
}
```

**Response 200:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440002",
  "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "450e8400-e29b-41d4-a716-446655440099",
  "restaurante_id": "650e8400-e29b-41d4-a716-446655440001",
  "repartidor_id": null,
  "estrellas": 4,
  "comentario": "Actualizado: la comida fue buena",
  "created_at": "2026-05-04T10:30:00+00:00",
  "updated_at": "2026-05-04T10:35:00+00:00"
}
```

### DELETE /ratings/restaurant/:id
Eliminar calificación.

**Response 204:** (No Content)

**Response 404:**
```json
{
  "error": "not_found",
  "message": "Calificación no encontrada"
}
```

## Calificaciones Repartidor

### POST /ratings/delivery
Crear calificación para un repartidor.

**Request:**
```json
{
  "pedido_id": "550e8400-e29b-41d4-a716-446655440000",
  "repartidor_id": "850e8400-e29b-41d4-a716-446655440003",
  "estrellas": 5,
  "comentario": "Llegó rápido"
}
```

**Nota:** Solo `repartidor_id` es necesario. `restaurante_id` puede ser null o omitido.

Mismo patrón de endpoints:
- `GET /ratings/delivery/:id`
- `GET /ratings/delivery/user/:userId`
- `GET /ratings/delivery/delivery/:repartidorId`
- `PATCH /ratings/delivery/:id`
- `DELETE /ratings/delivery/:id`

**GET /ratings/delivery/delivery/:repartidorId** retorna lista con stats.

## Estadísticas

### GET /ratings/stats/restaurant/:restauranteId
Obtener estadísticas agregadas del restaurante.

**Response 200:**
```json
{
  "average_rating": 4.7,
  "total_ratings": 42,
  "distribution": {
    "5": 35,
    "4": 5,
    "3": 2,
    "2": 0,
    "1": 0
  }
}
```

### GET /ratings/stats/delivery/:repartidorId
Obtener estadísticas agregadas del repartidor.

**Response 200:**
```json
{
  "average_rating": 4.8,
  "total_ratings": 120,
  "distribution": {
    "5": 105,
    "4": 12,
    "3": 3,
    "2": 0,
    "1": 0
  }
}
```

## Schema Reference

### Tablas DB

**calificaciones_restaurante:**
- `id` UUID PK
- `pedido_id` UUID NOT NULL
- `user_id` UUID NOT NULL
- `restaurante_id` UUID NOT NULL
- `estrellas` INT NOT NULL (1-5)
- `comentario` VARCHAR(500)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- UNIQUE(pedido_id, user_id)

**calificaciones_repartidor:**
- `id` UUID PK
- `pedido_id` UUID NOT NULL
- `user_id` UUID NOT NULL
- `repartidor_id` UUID NOT NULL
- `estrellas` INT NOT NULL (1-5)
- `comentario` VARCHAR(500)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- UNIQUE(pedido_id, user_id)

**pedidos_entregados:**
- `id` UUID PK
- `pedido_id` UUID NOT NULL UNIQUE
- `user_id` UUID NOT NULL
- `repartidor_id` UUID NOT NULL
- `restaurante_id` UUID NOT NULL
- `delivered_at` TIMESTAMP
- `created_at` TIMESTAMP

Índices en: `restaurante_id`, `repartidor_id`, `user_id`, `pedido_id`.

## Rate Limiting

No implementado aún.

## Notas de Implementación

- Fechas en ISO 8601 (UTC)
- UUIDs como strings
- Deletes físicos (no soft delete)
- user_id generado con `Uuid::new_v4()` (mock - futuro: extraer de JWT)
- Swagger/OpenAPI generado automáticamente con utoipa
- RabbitMQ consumer para eventos `order.delivered` (opcional)