# Notifications Service API Documentation

## Overview
Notifications Service es un Cloudflare Worker que gestiona notificaciones de usuario via Cloudflare KV. Soporta creación, listado y marcado como leído. Valida propiedad por JWT.

**Base URL:** `https://pedidoscampus-notificaciones.argoty-javier-3114.workers.dev`

**Via Gateway:** `http://localhost:3000/notifications` (local)

---

## Authentication

**All endpoints require:**
- `x-service-token` header (inyectado por Gateway automáticamente)

**User-accessible endpoints also require:**
- `Authorization: Bearer <accessToken>` header (JWT)

---

## Endpoints

### 1. POST /notifications
Crea nueva notificación (llamado por Order Service internamente).

**Requirements:**
- `x-service-token` header (internal call from Order Service)
- **NO requiere JWT** (microservicio a microservicio)

**Request:**
```json
{
  "userId": "uuid (required)",
  "tipo": "string (required, max: 255)",
  "mensaje": "string (required, max: 1000)",
  "payload": "any (optional, arbitrary data)"
}
```

**Tipos válidos de notificación (examples):**
- `PEDIDO_CREADO` - Pedido creado
- `PEDIDO_CONFIRMADO` - Confirmación de pedido
- `PEDIDO_PREPARANDO` - Preparando
- `PEDIDO_LISTO` - Listo para recoger
- `PEDIDO_EN_CAMINO` - En camino
- `PEDIDO_ENTREGADO` - Entregado
- (Custom types allowed)

**Response (201):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado",
  "payload": {
    "pedidoId": "p-123",
    "total": 45000
  },
  "leida": false,
  "createdAt": "2026-04-28T00:00:00.000Z",
  "readAt": null
}
```

**Error Responses:**
- `400`: Invalid JSON body
- `400`: Missing required fields (userId, tipo, mensaje)
- `400`: Invalid userId format (e.g., starts with "Bearer")
- `403`: Invalid `x-service-token`

---

### 2. GET /notifications
Lista notificaciones del usuario autenticado (paginado).

**Requirements:**
- `x-service-token` header
- `Authorization: Bearer <accessToken>` header (JWT)

**JWT extraído:** `sub` field = userId

**Query Parameters:**
- `limit` (optional, default: 50, max: 200) - Número de notificaciones por página
- `cursor` (optional) - Cursor de paginación (opaco, retornado en respuesta anterior)

**Request:**
```
GET /notifications?limit=25&cursor=abc123
```

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "user-a",
      "tipo": "PEDIDO_ENTREGADO",
      "mensaje": "Tu pedido fue entregado",
      "payload": {
        "pedidoId": "p-456",
        "deliveryTime": "14:30"
      },
      "leida": true,
      "createdAt": "2026-04-28T10:00:00.000Z",
      "readAt": "2026-04-28T10:15:00.000Z"
    },
    {
      "id": "uuid",
      "userId": "user-a",
      "tipo": "PEDIDO_EN_CAMINO",
      "mensaje": "Tu pedido está en camino",
      "payload": null,
      "leida": false,
      "createdAt": "2026-04-28T09:30:00.000Z",
      "readAt": null
    }
  ],
  "nextCursor": "def456" | null
}
```

**Paginación:**
- Si `nextCursor` es `null` → No hay más notificaciones
- Si `nextCursor` es string → Usar en próxima request como `cursor` parameter

**Error Responses:**
- `401`: Missing/invalid JWT
- `403`: Invalid `x-service-token`
- `400`: Invalid limit parameter (debe ser número >= 1)

---

### 3. PATCH /notifications/:id/leer
Marca notificación como leída.

**Requirements:**
- `x-service-token` header
- `Authorization: Bearer <accessToken>` header (JWT)
- Notificación debe pertenecer al usuario (validación por userId)

**Request:**
```
PATCH /notifications/abc-123-def/leer
```

**Response (200):**
```json
{
  "id": "abc-123-def",
  "userId": "user-a",
  "tipo": "PEDIDO_PREPARANDO",
  "mensaje": "Tu pedido se está preparando",
  "payload": null,
  "leida": true,
  "createdAt": "2026-04-28T09:00:00.000Z",
  "readAt": "2026-04-28T10:30:00.000Z"
}
```

**Error Responses:**
- `401`: Missing/invalid JWT
- `403`: Invalid `x-service-token`
- `403`: Notification belongs to different user
- `404`: Notification not found

---

### 4. GET /health
Health check del worker (smoke test).

**Requirements:**
- `x-service-token` header (internal monitoring)

**Request:**
```
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "service": "notificaciones-service",
  "runtime": "cloudflare-workers",
  "storage": "cloudflare-kv",
  "now": "2026-04-28T15:30:45.123Z"
}
```

**Error Responses:**
- `403`: Invalid `x-service-token`

---

## Data Models

### NotificationRecord
```typescript
{
  id: string;              // UUID
  userId: string;          // UUID del propietario
  tipo: string;            // Tipo de notificación
  mensaje: string;         // Mensaje legible
  payload: any;            // Datos adicionales (opcional)
  leida: boolean;          // Estado de lectura
  createdAt: string;       // ISO 8601 timestamp
  readAt: string | null;   // ISO 8601 timestamp o null si no leída
}
```

### CreateNotificationInput
```typescript
{
  userId: string;          // Requerido
  tipo: string;            // Requerido
  mensaje: string;         // Requerido
  payload?: any;           // Opcional
}
```

### ListNotificationsResult
```typescript
{
  notifications: NotificationRecord[];
  nextCursor: string | null;
}
```

---

## Storage (Cloudflare KV)

**Namespace:** `NOTIFICATIONS`

**Key Patterns:**
- **Primary:** `notif:{userId}:{createdAtMs}` → JSON serialized NotificationRecord
- **Index:** `notif_id:{id}` → Primary key (enables PATCH lookup)

**Characteristics:**
- Eventually consistent
- ~100ms global propagation
- Suitable for non-critical notifications

---

## Security Notes

1. **JWT Validation:**
   - Worker extracts `sub` field from JWT payload (no cryptographic verification, trusts Gateway)
   - Gateway validates JWT cryptographically before forwarding

2. **User Isolation:**
   - GET /notifications returns only user's own notifications
   - PATCH /notifications/:id/leer validates notification ownership
   - Non-owner attempts return 403 Forbidden

3. **Service Token:**
   - Internal microservices must provide valid `x-service-token`
   - Invalid token returns 403 Forbidden

4. **POST (Order Service):**
   - Does NOT require JWT (internal service-to-service)
   - Only requires `x-service-token`

---

## CORS Headers

All responses include:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PATCH,OPTIONS
Access-Control-Allow-Headers: content-type,authorization
```

---

## Error Response Format

All errors follow:
```json
{
  "error": "Human-readable error message"
}
```

| Status | Code | Scenario |
|--------|------|----------|
| `400` | Bad Request | Invalid JSON / missing required fields / invalid parameters |
| `401` | Unauthorized | Missing/invalid JWT |
| `403` | Forbidden | Invalid service token / user doesn't own notification |
| `404` | Not Found | Notification doesn't exist |
| `405` | Method Not Allowed | Wrong HTTP method for endpoint |
| `500` | Internal Server Error | Worker error |

---

## Example Flows

### 1. Order Service Creates Notification
```
POST /notifications
x-service-token: valid-token
Content-Type: application/json

{
  "userId": "user-123",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado",
  "payload": { "pedidoId": "p-999", "total": 75000 }
}

→ 201 Created
← { "id": "notif-abc", "leida": false, ... }
```

### 2. User Lists Own Notifications
```
GET /notifications?limit=10
x-service-token: valid-token
Authorization: Bearer eyJhbGc...

→ 200 OK
← {
  "notifications": [...],
  "nextCursor": "next-page-cursor"
}
```

### 3. User Marks Notification as Read
```
PATCH /notifications/notif-abc/leer
x-service-token: valid-token
Authorization: Bearer eyJhbGc...

→ 200 OK
← { "id": "notif-abc", "leida": true, "readAt": "2026-04-28T15:30:45.123Z" }
```

---

## Deployment

**Current Deployment:**
- https://pedidoscampus-notificaciones.argoty-javier-3114.workers.dev
- Version ID: See worker deployment logs

**Deploy Command:**
```bash
cd microservices/notificaciones-service
npm run deploy
```

**Environment Variables (via Wrangler):**
- `SERVICE_TOKEN` - Set via `wrangler secret put SERVICE_TOKEN`

**KV Binding:**
- `NOTIFICATIONS` - Cloudflare KV namespace (ID: c39c0014b293439f8523197ae6c0e090)
