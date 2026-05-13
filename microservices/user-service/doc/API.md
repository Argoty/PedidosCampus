# User Service — API

## Descripción
Servicio de gestión de perfiles de usuario y repartidor. CRUD, disponibilidad y listados para administración.

## Autenticación
Todos los endpoints requieren JWT válido. Roles disponibles: `usuario`, `repartidor`, `admin`.
Endpoints internos (delivery, search, reserve, release) requieren header `X-Client: gateway`.

## Modelo de Dominio

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Id | GUID | Identificador único del perfil |
| UserId | GUID | Referencia a Auth Service (NO expuesto en responses) |
| Tipo | string | "usuario" o "repartidor" |
| Nombre | string | Nombre completo |
| Telefono | string? | Teléfono de contacto |
| Direccion | string? | Dirección |
| Disponible | bool | Disponibilidad del repartidor |
| IsActive | bool | Perfil activo (soft delete) |
| ReservedUntil | DateTime? | Reserva atómica (TTL) |
| CreatedAt | DateTime | Fecha de creación |
| UpdatedAt | DateTime | Fecha de actualización |

## DTOs

### Request DTOs

```json
// CreateProfileRequest
{ "tipo": "usuario"|"repartidor", "nombre": "string", "telefono": "string?", "direccion": "string?" }

// UpdateProfileRequest
{ "nombre": "string?", "telefono": "string?", "direccion": "string?" }

// AvailabilityRequest
{ "disponible": true|false }

// ReserveRequest
{ "ttlSeconds": number? }
```

### Response DTOs

```json
// UserProfileResponse
{ "id": "guid", "tipo": "string", "nombre": "string", "telefono": "string?", "direccion": "string?", "disponible": bool, "isActive": bool, "createdAt": "datetime", "updatedAt": "datetime" }

// AvailabilityResponse
{ "disponible": bool, "reservedUntil": "datetime?" }

// ReserveResponse
{ "reservedUntil": "datetime" }

// PaginatedResponse<T>
{ "data": T[], "total": number, "offset": number, "limit": number }

// ErrorResponse
{ "code": "string", "message": "string", "details": object? }
```

## Endpoints HTTP

### Endpoints de Usuario

| # | Método | Ruta | Roles | Descripción |
|---|--------|------|------|-------------|
| 1 | GET | /api/profiles/me | usuario, repartidor, admin | Obtener perfil propio |
| 2 | POST | /api/profiles | usuario, repartidor, admin | Crear nuevo perfil |
| 3 | PATCH | /api/profiles/me | usuario, repartidor, admin | Actualizar perfil propio |
| 4 | POST | /api/profiles/me/availability | repartidor | Cambiar disponibilidad |
| 5 | GET | /api/profiles/me/availability | repartidor | Obtener disponibilidad |

### Endpoints de Administración

| # | Método | Ruta | Roles | Descripción |
|---|--------|------|------|-------------|
| 6 | GET | /api/profiles | admin | Listar perfiles (filtros: tipo, isActive, limit, offset) |
| 7 | GET | /api/profiles/{profileId} | admin | Obtener perfil por ID |
| 8 | PATCH | /api/profiles/{profileId} | admin | Actualizar perfil por ID |
| 9 | POST | /api/profiles/{profileId}/deactivate | admin | Desactivar perfil |
| 10 | POST | /api/profiles/{profileId}/activate | admin | Activar perfil |
| 11 | DELETE | /api/profiles/{profileId} | admin | Eliminar perfil permanentemente |

### Endpoints Internos (X-Client: gateway)

| # | Método | Ruta | Descripción |
|---|--------|------|-------------|
| 12 | GET | /api/profiles/delivery | Listar repartidores disponibles |
| 13 | GET | /api/profiles/search | Búsqueda avanzada (filtros: tipo, disponible) |
| 14 | POST | /api/profiles/{profileId}/reserve | Reserva atómica (TTL) |
| 15 | POST | /api/profiles/{profileId}/release | Liberar reserva |

## Códigos de Error HTTP

| Código | Descripción |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

## Integración con order-service

El order-service consume los siguientes endpoints internos:
- GET /api/profiles/delivery?onlyAvailable=true → Lista repartidores disponibles
- POST /api/profiles/{profileId}/reserve → Reserva atómica para evitar race conditions
- POST /api/profiles/{profileId}/release → Libera reserva

## Eventos RabbitMQ (pendientes)

| Evento | Payload |
|--------|---------|
| repartidor.availability.changed | { profileId, userId, disponible, timestamp } |
| profile.created | { profileId, userId, tipo, timestamp } |
| profile.updated | { profileId, changes, timestamp } |
| profile.deactivated | { profileId, reason?, timestamp } |
| profile.reserved | { profileId, reservedBy?, reservedUntil, timestamp } |
| profile.released | { profileId, releasedBy?, timestamp } |

---

**Última actualización:** Mayo 2026