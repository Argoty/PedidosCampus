# API.md — Rating Service

## Overview

Servicio de calificaciones para restaurantes y repartidores. CRUD operations con búsquedas por usuario, restaurante, repartidor.

Puerto: **8003**
Base URL: `http://localhost:8003`

## Autenticación

Header requerido en todos endpoints (excepto health):
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
- **409** — Conflict (ej: duplicate rating)
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
  "pedidoId": "550e8400-e29b-41d4-a716-446655440000",
  "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
  "estrellas": 5,
  "comentario": "Excelente comida"
}
```

**Validaciones:**
- `estrellas`: 1-5
- `comentario`: max 500 caracteres
- `pedidoId` + `userId` (del JWT) debe ser unique

**Response 201:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440002",
  "pedidoId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid-from-jwt",
  "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
  "estrellas": 5,
  "comentario": "Excelente comida",
  "createdAt": "2024-04-25T10:30:00Z",
  "updatedAt": "2024-04-25T10:30:00Z"
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
  "pedidoId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid-from-jwt",
  "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
  "estrellas": 5,
  "comentario": "Excelente comida",
  "createdAt": "2024-04-25T10:30:00Z",
  "updatedAt": "2024-04-25T10:30:00Z"
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
Listar todas las calificaciones del usuario actual (extraído del JWT).

Query params (opcionales):
- `limit`: max 50 (default 10)
- `offset`: default 0
- `sort`: "createdAt" (default) | "estrellas"
- `order`: "asc" | "desc" (default)

**Response 200:**
```json
{
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "pedidoId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-uuid-from-jwt",
      "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
      "estrellas": 5,
      "comentario": "Excelente comida",
      "createdAt": "2024-04-25T10:30:00Z",
      "updatedAt": "2024-04-25T10:30:00Z"
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
      "pedidoId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-uuid-from-jwt",
      "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
      "estrellas": 5,
      "comentario": "Excelente comida",
      "createdAt": "2024-04-25T10:30:00Z",
      "updatedAt": "2024-04-25T10:30:00Z"
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
Actualizar calificación (solo autor o admin).

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
  "pedidoId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid-from-jwt",
  "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
  "estrellas": 4,
  "comentario": "Actualizado: la comida fue buena",
  "createdAt": "2024-04-25T10:30:00Z",
  "updatedAt": "2024-04-25T10:35:00Z"
}
```

### DELETE /ratings/restaurant/:id
Eliminar calificación (solo autor o admin).

**Response 204:** (No Content)

**Response 404:**
```json
{
  "error": "not_found",
  "message": "Calificación no encontrada"
}
```

## Calificaciones Repartidor

Mismo patrón que Restaurante, pero en endpoints `/ratings/delivery/*`:

- `POST /ratings/delivery`
- `GET /ratings/delivery/:id`
- `GET /ratings/delivery/user/:userId`
- `GET /ratings/delivery/delivery/:repartidorId`
- `PATCH /ratings/delivery/:id`
- `DELETE /ratings/delivery/:id`

Request/Response identical excepto `restauranteId` → `repartidorId`.

**GET /ratings/delivery/delivery/:repartidorId** retorna `stats` igual que restaurantes:
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

## Estadísticas

### GET /ratings/stats/restaurant/:restauranteId
Obtener estadísticas agregadas de calificaciones del restaurante.

**Response 200:**
```json
{
  "restauranteId": "650e8400-e29b-41d4-a716-446655440001",
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
Obtener estadísticas agregadas de calificaciones del repartidor.

**Response 200:**
```json
{
  "repartidorId": "850e8400-e29b-41d4-a716-446655440003",
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

## Rate Limiting

No implementado aún. Futuro: 100 requests/minuto por usuario.

## Notas de Implementación

- Todas las fechas en ISO 8601 (UTC)
- UUIDs como strings
- Soft deletes NO (deletes físicos)
- Índices en `restauranteId`, `repartidorId`, `userId` para queries rápidas
- Constraint único: `(pedidoId, userId)` per tabla (evita duplicados)
