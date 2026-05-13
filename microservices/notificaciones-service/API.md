# API de Notificaciones Service

## Introducción

Notificaciones Service es un microservicio serverless desarrollado sobre Cloudflare Workers que gestiona el sistema de notificaciones para la plataforma PedidosCampus. Este servicio proporciona una API RESTful para la creación, listado y gestión del estado de lectura de notificaciones de usuario, utilizando Cloudflare KV como almacenamiento persistente.

El servicio está diseñado para operar dentro de una arquitectura de microservicios donde actúa como receptor de eventos asynchronously desde Order Service (para la creación de notificaciones) y como proveedor de datos consultables directamente por los usuarios autenticados a través del Gateway.

### Características Principales

- **Almacenamiento**: Cloudflare KV para persistencia de notificaciones con consistencia eventual
- **Autenticación**: JWT para acceso de usuario y Service Token para comunicación inter-servicios
- **Paginación**: Soporte para paginación basada en cursors en endpoints de listado
- **Arquitectura**: Serverless deployment en Cloudflare Workers sin dependencias de frameworks externos

---

## Autenticación y Autorización

El servicio implementa un esquema de autenticación dual dependiendo del contexto de cada endpoint.

### Headers de Autenticación

| Header | Requerido | Descripción |
|--------|----------|-------------|
| `x-service-token` | **Siempre** | Token de servicio utilizado por el Gateway para validar comunicación interna entre microservicios |
| `Authorization` | Selectivo | Token JWT en formato `Bearer <accessToken>` requerido para endpoints de acceso de usuario |

### Flujo de Autenticación

1. **Validación del Service Token**: Todos los requests deben incluir un `x-service-token` válido en el header. Este token es configurado a nivel de Worker mediante variables de entorno de Cloudflare y es inyectado automáticamente por el Gateway en cada request proxado.

2. **Validación JWT (selectiva)**: Los endpoints que requieren identidad de usuario extraen el `userId` del campo `sub` del payload del JWT (posición media del token codificado en base64). El Gateway valida cryptográficamente el JWT antes de reenviar el request, por lo que el Worker confía en la información del token sin verificación adicional.

---

## Endpoints

### GET /health

Health check del Worker utilizado para verificación de disponibilidad y smoke testing post-despliegue.

**Método**: `GET`  
**Ruta**: `/health`  
**Requiere**: `x-service-token`

**Request de ejemplo**:

```http
GET /health
x-service-token: your-service-token
```

**Respuesta exitosa (200)**:

```json
{
  "status": "ok",
  "service": "notificaciones-service",
  "runtime": "cloudflare-workers",
  "storage": "cloudflare-kv",
  "now": "2026-05-04T12:00:00.000Z"
}
```

**Respuestas de error**:

| Código | Condición |
|--------|----------|
| 403 | Token de servicio inválido o ausente |

---

### POST /notifications

Crea una nueva notificación en el sistema. Este endpoint es llamado internamente por Order Service cuando ocurre un evento relevante (por ejemplo, cuando un pedido cambia de estado).

**Método**: `POST`  
**Ruta**: `/notifications`  
**Requiere**: `x-service-token`  
**NO requiere**: JWT (comunicación inter-servicios)

#### Headers del Request

| Header | Tipo | Requerido | Descripción |
|--------|------|----------|-------------|
| `x-service-token` | string | Sí | Token de servicio válido |
| `Content-Type` | string | Sí | Debe ser `application/json` |

#### Body del Request

```json
{
  "userId": "uuid-del-usuario",
  "tipo": "TIPO_NOTIFICACION",
  "mensaje": "Mensaje legible para el usuario",
  "payload": { "campo": "datos-adicionales" }
}
```

**Parámetros del body**:

| Campo | Tipo | Requerido | Descripción | Validación |
|-------|------|----------|-------------|------------|
| `userId` | string | Sí | UUID del usuario destinatario | No puede estar vacío ni comenzar con "Bearer " |
| `tipo` | string | Sí | Tipo de notificación | Máximo 255 caracteres, no puede estar vacío |
| `mensaje` | string | Sí | Mensaje legible para el usuario | Máximo 1000 caracteres, no puede estar vacío |
| `payload` | any | No | Datos adicionales arbitrarios | Cualquier valor JSON válido |

#### Tipos de Notificación

Los siguientes tipos de notificación son utilizados convencionalmente en el flujo de pedidos:

| Tipo | Descripción |
|------|-------------|
| `PEDIDO_CREADO` | Notificación cuando un nuevo pedal es creado |
| `PEDIDO_CONFIRMADO` | Notificación de confirmación del pedido |
| `PEDIDO_PREPARANDO` | Notificación cuando el restaurante inicia la preparación |
| `PEDIDO_LISTO` | Notificación cuando el pedido está listo para recoger |
| `PEDIDO_EN_CAMINO` | Notificación cuando el delivery está en camino |
| `PEDIDO_ENTREGADO` | Notificación cuando el pedido fue entregado |

Sin embargo, el sistema permite tipos personalizados más allá de los listados.

#### Response (201 Created)

```json
{
  "id": "uuid-notificacion",
  "userId": "uuid-usuario",
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

**Respuestas de error**:

| Código | Condición |
|--------|----------|
| 400 | Body JSON inválido |
| 400 | Campos requeridos faltantes (userId, tipo, mensaje) |
| 400 | Formato de userId inválido (contiene "Bearer ") |
| 403 | Token de servicio inválido |

#### Ejemplo Completo

```http
POST /notifications
x-service-token: your-service-token
Content-Type: application/json

{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado exitosamente",
  "payload": {
    "pedidoId": "PED-2026-001",
    "total": 75000,
    "items": 3
  }
}
```

```http
201 Created
Content-Type: application/json

{
  "id": "notif-abc-123-def-456",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado exitosamente",
  "payload": {
    "pedidoId": "PED-2026-001",
    "total": 75000,
    "items": 3
  },
  "leida": false,
  "createdAt": "2026-05-04T10:30:00.000Z",
  "readAt": null
}
```

---

### GET /notifications

Lista las notificaciones del usuario autenticado con soporte para paginación. Este endpoint retorna las notificaciones ordenadas descendientemente por fecha (más recientes primero).

**Método**: `GET`  
**Ruta**: `/notifications`  
**Requiere**: `x-service-token` + JWT (authorization header)

#### Headers del Request

| Header | Tipo | Requerido | Descripción |
|--------|------|----------|-------------|
| `x-service-token` | string | Sí | Token de servicio válido |
| `Authorization` | string | Sí | JWT en formato `Bearer <token>` |

#### Query Parameters

| Parámetro | Tipo | Requerido | Default | Descripción | Validación |
|-----------|------|----------|---------|-------------|------------|
| `limit` | number | No | 50 | Número de notificaciones por página | Debe ser >= 1 y <= 200 |
| `cursor` | string | No | - | Cursor de paginación opaco | Valor retornado en previous `nextCursor` |

#### Response (200 OK)

```json
{
  "notifications": [
    {
      "id": "uuid-notificacion",
      "userId": "uuid-usuario",
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
      "id": "uuid-notificacion-2",
      "userId": "uuid-usuario",
      "tipo": "PEDIDO_EN_CAMINO",
      "mensaje": "Tu pedido está en camino",
      "payload": null,
      "leida": false,
      "createdAt": "2026-04-28T09:30:00.000Z",
      "readAt": null
    }
  ],
  "nextCursor": "def456cursor"
}
```

**Paginación**:

- Si `nextCursor` es `null`, no hay más notificaciones que retrieve.
- Si `nextCursor` es un string, se utiliza como valor del parámetro `cursor` en la siguiente request para obtener la página siguiente.

**Respuestas de error**:

| Código | Condición |
|--------|----------|
| 401 | JWT ausente o inválido |
| 403 | Token de servicio inválido |
| 400 | Parámetro `limit` inválido (debe ser número >= 1) |

#### Ejemplo Completo

```http
GET /notifications?limit=10&cursor=abc123cursor
x-service-token: your-service-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAifQ.signature
```

```http
200 OK
Content-Type: application/json

{
  "notifications": [
    {
      "id": "notif-001",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tipo": "PEDIDO_ENTREGADO",
      "mensaje": "Tu pedido fue entregado",
      "payload": {"pedidoId": "PED-001"},
      "leida": true,
      "createdAt": "2026-05-04T09:00:00.000Z",
      "readAt": "2026-05-04T09:05:00.000Z"
    }
  ],
  "nextCursor": null
}
```

---

### PATCH /notifications/:id/leer

Marca una notificación específica como leída. El sistema valida que la notificación pertenezca al usuario autenticado antes de proceder con la actualización.

**Método**: `PATCH`  
**Ruta**: `/notifications/:id/leer`  
**Requiere**: `x-service-token` + JWT (authorization header)

#### Headers del Request

| Header | Tipo | Requerido | Descripción |
|--------|------|----------|-------------|
| `x-service-token` | string | Sí | Token de servicio válido |
| `Authorization` | string |Sí | JWT en formato `Bearer <token>` |

#### Path Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | UUID de la notificación a marcar como leída |

#### Response (200 OK)

```json
{
  "id": "abc-123-def",
  "userId": "uuid-usuario",
  "tipo": "PEDIDO_PREPARANDO",
  "mensaje": "Tu pedido se está preparando",
  "payload": null,
  "leida": true,
  "createdAt": "2026-04-28T09:00:00.000Z",
  "readAt": "2026-04-28T10:30:00.000Z"
}
```

**Respuestas de error**:

| Código | Condición |
|--------|----------|
| 401 | JWT ausente o inválido |
| 403 | Token de servicio inválido |
| 403 | La notificación pertenece a otro usuario |
| 404 | Notificación no encontrada |

#### Ejemplo Completo

```http
PATCH /notifications/notif-abc-123-def-456/leer
x-service-token: your-service-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAifQ.signature
```

```http
200 OK
Content-Type: application/json

{
  "id": "notif-abc-123-def-456",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tipo": "PEDIDO_PREPARANDO",
  "mensaje": "Tu pedido se está preparando",
  "payload": null,
  "leida": true,
  "createdAt": "2026-05-04T08:00:00.000Z",
  "readAt": "2026-05-04T10:30:00.000Z"
}
```

---

## Modelos de Datos

### NotificationRecord

Representa una notificación almacenada en el sistema.

```typescript
interface NotificationRecord {
  id: string;              // UUID único de la notificación
  userId: string;         // UUID del usuario propietario
  tipo: string;           // Tipo de notificación
  mensaje: string;        // Mensaje legible para el usuario
  payload: unknown;       // Datos adicionales arbitrarios
  leida: boolean;         // Estado de lectura
  createdAt: string;      // Timestamp ISO 8601 de creación
  readAt: string | null;  // Timestamp ISO 8601 de lectura (null si no leída)
}
```

### CreateNotificationInput

Input para la creación de notificaciones.

```typescript
interface CreateNotificationInput {
  userId: string;    // Requerido: UUID del usuario
  tipo: string;      // Requerido: tipo de notificación
  mensaje: string;   // Requerido: mensaje legible
  payload?: unknown; // Opcional: datos adicionales
}
```

### ListNotificationsResult

Resultado del listado de notificaciones con paginación.

```typescript
interface ListNotificationsResult {
  notifications: NotificationRecord[]; // Array de notificaciones
  nextCursor: string | null;               // Cursor para siguiente página o null
}
```

---

## Almacenamiento

### Cloudflare KV

El servicio utiliza Cloudflare KV (Key-Value Storage) como almacenamiento persistente para las notificaciones.

**Namespace**: `NOTIFICATIONS`  
**Binding**: `NOTIFICATIONS` en la configuración del Worker

### Esquema de Keys

El sistema utiliza dos tipos de keys para gestionar las notificaciones:

**Clave Primaria**:
- Formato: `notif:{userId}:{createdAtMs}`
- Valor: JSON serializado de `NotificationRecord`
- Utilizada para listar notificaciones por usuario eficientemente usando el prefijo

**Índice por ID**:
- Formato: `notif_id:{id}`
- Valor: Clave primaria (para enables lookup O(1) por ID en operaciones PATCH)

### Características del Almacenamiento

- **Consistencia eventual**: Los datos escritos pueden no estar inmediatamente disponibles Globally
- **Propagación**: Aproximadamente 60ms de latencia para replicación global
- **Caso de uso apropiado**: Notificaciones no son datos críticos que requieran consistencia inmediata

---

## Cabeceras CORS

Todas las respuestas incluyen las siguientes cabeceras CORS para permitir requests desde navegadores y clientes externos:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS
Access-Control-Allow-Headers: content-type, authorization
```

El método `OPTIONS` retorna una respuesta 204 sin contenido para permitir preflight requests.

---

## Formato de Respuestas de Error

Todos los errores siguen un formato consistente:

```json
{
  "error": "Mensaje de error legible para humanos"
}
```

### Códigos de Estado de Error

| Código | Significado | Escenario |
|--------|-------------|----------|
| 400 | Bad Request | JSON inválido / campos requeridos faltantes / parámetros inválidos |
| 401 | Unauthorized | JWT faltante o inválido |
| 403 | Forbidden | Token de servicio inválido / usuario no es propietario de la notificación |
| 404 | Not Found | Notificación no encontrada |
| 405 | Method Not Allowed | Método HTTP no soportado para el endpoint |
| 500 | Internal Server Error | Error inesperado del Worker |

---

## Ejemplos de Flujos

### Flujo 1: Order Service Crea Notificación

Cuando un usuario realiza un pedido, Order Service envía una notificación al servicio de notificaciones:

```http
POST /notifications
x-service-token: your-service-token
Content-Type: application/json

{
  "userId": "user-123-uuid",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado",
  "payload": {
    "pedidoId": "PED-2026-999",
    "total": 75000
  }
}
```

**Respuesta**:

```http
201 Created

{
  "id": "notif-abc-123",
  "userId": "user-123-uuid",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado",
  "payload": {...},
  "leida": false,
  "createdAt": "2026-05-04T10:30:00.000Z",
  "readAt": null
}
```

### Flujo 2: Usuario Lista Sus Notificaciones

Un usuario autenticado consulta sus notificaciones:

```http
GET /notifications?limit=10
x-service-token: your-service-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMy11dWlkIn0.signature
```

**Respuesta**:

```http
200 OK

{
  "notifications": [
    {...},
    {...}
  ],
  "nextCursor": "next-page-cursor"
}
```

### Flujo 3: Usuario Lee Notificación

Un usuario marca una notificación específica como leída:

```http
PATCH /notifications/notif-abc-123/leer
x-service-token: your-service-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMy11dWlkIn0.signature
```

**Respuesta**:

```http
200 OK

{
  "id": "notif-abc-123",
  "userId": "user-123-uuid",
  "tipo": "PEDIDO_CREADO",
  "mensaje": "Tu pedido ha sido creado",
  "payload": {...},
  "leida": true,
  "createdAt": "2026-05-04T10:30:00.000Z",
  "readAt": "2026-05-04T11:00:00.000Z"
}
```

---

## URLs de Despliegue

### Entorno de Producción

- **URL Base**: `https://pedidoscampus-notificaciones.argoty-javier-3114.workers.dev`

### Acceso Local via Gateway

Cuando se ejecuta la suite completa de microservicios:

- **URL Local**: `http://localhost:3000/notifications` (a través del Gateway)

---

## Despliegue

### comandos de Deployment

```bash
cd microservices/notificaciones-service
npm run deploy
```

### Variables de Entorno

Las siguientes variables deben ser configuradas en el entorno de Cloudflare Workers:

| Variable | Configuración | Descripción |
|----------|---------------|-------------|
| `SERVICE_TOKEN` | Secret (via wrangler) | Token de servicio para validación inter-servicios |

**Configuración de secret**:

```bash
wrangler secret put SERVICE_TOKEN
```

### KV Binding

| Binding | Namespace ID |
|---------|------------|
| `NOTIFICATIONS` | `c39c0014b293439f8523197ae6c0e090` |

---

## Notas de Seguridad

### Validación JWT

El Worker extrae el campo `sub` del payload del JWT para determinar la identidad del usuario. No realiza verificación cryptográfica del token porque asume que el Gateway ya validó el JWT antes de proxar el request. Esta es una decisión de diseño basada en la confianza en la capa del Gateway.

### Aislamiento por Usuario

- El endpoint `GET /notifications` filtranotifications por el `userId` extraído del JWT
- El endpoint `PATCH /notifications/:id/leer` valida que la notificación pertenezca al usuario autenticado antes de permitir la modificación
- Intentar modificar notificaciones de otros usuarios retorna 403 Forbidden

### Comunicación Inter-Servicios

- El endpoint `POST /notifications` no requiere JWT porque está diseñado exclusivamente para comunicación entre servicios internos
- Solo el header `x-service-token` es requerido
- Esto permite a Order Service crear notificaciones sin tener un JWT de usuario