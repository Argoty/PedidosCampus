# Order Service — API Documentation

Microservicio **Pedidos (order-service)** para gestionar el ciclo completo de pedidos según **RF-PED-01 a RF-PED-08** en RequisitosFuncionales.md.

---

## 📋 Índice

1. [Autenticación & Autorización](#autenticación--autorización)
2. [Modelos de Datos](#modelos-de-datos)
3. [Endpoints HTTP](#endpoints-http)
4. [Estructura de Errores](#estructura-de-errores)
5. [Eventos RabbitMQ](#eventos-rabbitmq)
6. [Integración con Microservicios](#integración-con-microservicios)
7. [Buenas Prácticas](#buenas-prácticas)

---

## Autenticación & Autorización

Todos los endpoints protegidos requieren **JWT válido** en el header `Authorization: Bearer {token}`.

**Roles válidos:**
- `usuario` — realiza pedidos, ve sus propios pedidos
- `repartidor` — acepta y actualiza estado de pedidos
- `admin` — acceso total a todos los pedidos

El Gateway valida el token y lo reenvía; el servicio valida el rol y la propiedad del recurso.

---

## Modelos de Datos

### Pedido
```json
{
  "id": "uuid",
  "userId": "uuid",                    // quien realizó el pedido
  "restauranteId": "uuid",
  "repartidorId": "uuid | null",      // null si aún no asignado
  "estado": "pendiente|aceptado|en_camino|entregado|cancelado",
  "subtotal": 25.50,
  "costoEntrega": 2.00,
  "total": 27.50,
  "direccionEntrega": "Cra 5 # 20-30",
  "createdAt": "2026-04-13T10:30:00Z",
  "updatedAt": "2026-04-13T10:35:00Z",
  "items": [{ "id", "productId", "nombre", "precioUnit", "cantidad", "subtotal" }],
  "historial": [{ "id", "fromEstado", "toEstado", "changedBy", "createdAt" }]
}
```

### PedidoItem
```json
{
  "id": "uuid",
  "pedidoId": "uuid",
  "productId": "uuid",                 // referencia a restaurante-service
  "nombre": "Hamburguesa Deluxe",
  "precioUnit": 12.75,
  "cantidad": 2,
  "subtotal": 25.50,
  "createdAt": "2026-04-13T10:30:00Z"
}
```

### PedidoEstadoLog
```json
{
  "id": "uuid",
  "pedidoId": "uuid",
  "fromEstado": "pendiente",
  "toEstado": "aceptado",
  "changedById": "uuid",               // usuario/repartidor que ejecutó
  "createdAt": "2026-04-13T10:31:00Z"
}
```

---

## Endpoints HTTP

### 1️⃣ Crear Pedido

**POST** `/orders`

**Roles:** `usuario`

**Body:**
```json
{
  "restauranteId": "uuid",
  "direccionEntrega": "Cra 5 # 20-30, Apto 304",
  "items": [
    {
      "productId": "uuid",
      "nombre": "Hamburguesa Deluxe",
      "precioUnit": 12.75,
      "cantidad": 2
    },
    {
      "productId": "uuid",
      "nombre": "Refresco",
      "precioUnit": 2.50,
      "cantidad": 1
    }
  ]
}
```

**Validaciones:**
- `items` no vacío (min 1 item)
- `cantidad` >= 1 per item
- `precioUnit` >= 0
- `direccionEntrega` presente y no vacía
- `userId` (del JWT) debe coincidir con usuario autenticado

**Lógica:**
1. Validar que el restaurante existe (consulta a restaurant-service)
2. Validar que cada producto existe y está disponible
3. Calcular: `subtotal = Σ(precioUnit * cantidad)`
4. Aplicar `costoEntrega` (configurable, default 2.0)
5. `total = subtotal + costoEntrega`
6. Crear `Pedido`, `PedidoItem(s)` y `PedidoEstadoLog` en **transacción única**
7. Publicar evento `order.created` a RabbitMQ

**Respuestas:**
- `201 Created`:
  ```json
  {
    "id": "uuid",
    "estado": "pendiente",
    "subtotal": 27.25,
    "costoEntrega": 2.00,
    "total": 29.25,
    "createdAt": "2026-04-13T10:30:00Z"
  }
  ```
- `400 Bad Request`: Validación fallida
- `404 Not Found`: Restaurante o producto no existe

---

### 2️⃣ Listar Pedidos (Historial del Usuario)

**GET** `/orders?limit=10&offset=0&estado=pendiente`

**Roles:** `usuario` (propios) | `admin` (todos)

**Query Params:**
- `limit` — items por página (default: 10, max: 100)
- `offset` — para paginación (default: 0)
- `estado` — filtro opcional: `pendiente|aceptado|en_camino|entregado`
- `restauranteId` — filtro opcional (admin solamente)
- `userId` — filtro opcional (admin solamente; usuario ignora y usa JWT)

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "restauranteId": "uuid",
      "repartidorId": "uuid | null",
      "estado": "aceptado",
      "subtotal": 27.25,
      "total": 29.25,
      "createdAt": "2026-04-13T10:30:00Z",
      "updatedAt": "2026-04-13T10:31:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 25
  }
}
```

- `200 OK`: Lista paginada
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Intento de listar pedidos ajenos (usuario)

---

### 3️⃣ Obtener Pedido por ID

**GET** `/orders/{orderId}`

**Roles:** `usuario` (owner) | `repartidor` (asignado) | `admin`

**Respuesta:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "restauranteId": "uuid",
  "repartidorId": "uuid | null",
  "estado": "en_camino",
  "subtotal": 27.25,
  "costoEntrega": 2.00,
  "total": 29.25,
  "direccionEntrega": "Cra 5 # 20-30, Apto 304",
  "createdAt": "2026-04-13T10:30:00Z",
  "updatedAt": "2026-04-13T10:35:00Z",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "nombre": "Hamburguesa Deluxe",
      "precioUnit": 12.75,
      "cantidad": 2,
      "subtotal": 25.50
    }
  ],
  "historial": [
    {
      "id": "uuid",
      "fromEstado": null,
      "toEstado": "pendiente",
      "changedBy": "system",
      "createdAt": "2026-04-13T10:30:00Z"
    },
    {
      "id": "uuid",
      "fromEstado": "pendiente",
      "toEstado": "aceptado",
      "changedBy": "repartidorId",
      "createdAt": "2026-04-13T10:31:00Z"
    },
    {
      "id": "uuid",
      "fromEstado": "aceptado",
      "toEstado": "en_camino",
      "changedBy": "repartidorId",
      "createdAt": "2026-04-13T10:32:00Z"
    }
  ]
}
```

- `200 OK`: Pedido con historial completo
- `403 Forbidden`: No autorizado a ver este pedido
- `404 Not Found`: Pedido no existe

---

### 4️⃣ Aceptar Pedido (Repartidor)

**POST** `/orders/{orderId}/accept`

**Roles:** `repartidor`

**Body:**
```json
{
  "repartidorId": "uuid"  // o usar del JWT
}
```

**Precondiciones:**
- Pedido en estado `pendiente`
- Repartidor debe estar marcado como disponible (consulta user-service)

**Lógica:**
1. Validar que pedido está en `pendiente`
2. Validar que repartidor está disponible
3. Asignar `repartidorId` al pedido
4. Cambiar estado a `aceptado`
5. Insertar `PedidoEstadoLog` (fromEstado: pendiente, toEstado: aceptado)
6. Publicar eventos `order.assigned` y `order.status.changed`

**Respuestas:**
- `200 OK`: Pedido actualizado
  ```json
  {
    "id": "uuid",
    "estado": "aceptado",
    "repartidorId": "uuid",
    "updatedAt": "2026-04-13T10:31:00Z"
  }
  ```
- `409 Conflict`: Pedido no está en `pendiente` o repartidor no disponible
- `404 Not Found`: Pedido o repartidor no existe

---

### 5️⃣ Actualizar Estado del Pedido

**POST** `/orders/{orderId}/status`

**Roles:** `repartidor` (asignado) | `admin`

**Body:**
```json
{
  "toEstado": "en_camino"
  // valores permitidos en request:
  // - en_camino
  // - entregado
}
```

**Validaciones:**
- Transiciones permitidas por estado actual (`aceptado` → `en_camino` → `entregado`)
- Solo repartidor asignado o admin pueden cambiar estado
- No se permite retroceder de estados

**Lógica:**
1. Validar transición válida
2. Validar autorización (repartidor asignado o admin)
3. Actualizar `estado` del pedido
4. Insertar `PedidoEstadoLog` con `fromEstado` y `toEstado`
5. Si llega a `entregado`, registrar timestamp de entrega
6. Publicar evento `order.status.changed`
7. Si es `entregado`, publicar evento `order.delivered` para que ratings lo capture

**Respuestas:**
- `200 OK`: Estado actualizado
  ```json
  {
    "id": "uuid",
    "estado": "entregado",
    "updatedAt": "2026-04-13T10:35:00Z"
  }
  ```
- `400 Bad Request`: Transición inválida
- `409 Conflict`: Pedido no puede cambiar de estado en este momento
- `403 Forbidden`: No autorizado

---

### 6️⃣ Listar Pedidos Activos (Admin)

**GET** `/orders/active?limit=10&offset=0&estado=aceptado&restauranteId=uuid`

**Roles:** `admin`

**Query Params:**
- `limit`, `offset` — paginación
- `estado` — filtro: `pendiente|aceptado|en_camino` (excluye entregados)
- `restauranteId` — filtro por restaurante
- `repartidorId` — filtro por repartidor (para ver sus asignaciones)

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "restauranteId": "uuid",
      "repartidorId": "uuid",
      "estado": "en_camino",
      "subtotal": 27.25,
      "total": 29.25,
      "createdAt": "2026-04-13T10:30:00Z",
      "updatedAt": "2026-04-13T10:35:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 15
  }
}
```

- `200 OK`: Lista filtrada de pedidos activos
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Solo admin

---

### 7️⃣ Obtener Historial de Estados de un Pedido

**GET** `/orders/{orderId}/history`

**Roles:** `usuario` (owner) | `repartidor` (asignado) | `admin`

**Respuesta:**
```json
{
  "orderId": "uuid",
  "history": [
    {
      "id": "uuid",
      "fromEstado": null,
      "toEstado": "pendiente",
      "changedBy": "system",
      "createdAt": "2026-04-13T10:30:00Z"
    },
    {
      "id": "uuid",
      "fromEstado": "pendiente",
      "toEstado": "aceptado",
      "changedBy": "uuid-repartidor",
      "createdAt": "2026-04-13T10:31:00Z"
    },
    {
      "id": "uuid",
      "fromEstado": "aceptado",
      "toEstado": "en_camino",
      "changedBy": "uuid-repartidor",
      "createdAt": "2026-04-13T10:32:00Z"
    }
  ]
}
```

- `200 OK`: Historial completo
- `403 Forbidden`: No autorizado
- `404 Not Found`: Pedido no existe

---

### 8️⃣ Cancelar Pedido

**POST** `/orders/{orderId}/cancel`

**Roles:** `usuario` (owner si pendiente) | `admin`

**Body:**
```json
{
  "reason": "Cambié de opinión"  // opcional
}
```

**Reglas:**
- Solo se puede cancelar si `estado == pendiente`
- Usuario solo puede cancelar sus propios pedidos
- Admin puede cancelar cualquier pedido en estado pendiente

**Lógica:**
1. Validar que pedido está en `pendiente`
2. Validar autorización
3. Actualizar estado a `cancelado` y registrar `cancelledAt`
4. Insertar `PedidoEstadoLog` (fromEstado: pendiente, toEstado: cancelado)
5. Publicar evento `order.cancelled` a RabbitMQ

**Respuestas:**
- `200 OK`: Cancelado
  ```json
  {
    "id": "uuid",
    "estado": "cancelado",
    "cancelledAt": "2026-04-13T10:40:00Z"
  }
  ```
- `400 Bad Request`: No se puede cancelar (estado != pendiente)
- `403 Forbidden`: No autorizado
- `404 Not Found`: Pedido no existe

---

### 9️⃣ Listar Pedidos Asignados a Repartidor

**GET** `/orders/deliverer/{repartidorId}?estado=en_camino&limit=10`

**Roles:** `repartidor` (propios) | `admin`

**Query Params:**
- `estado` — filtro: `aceptado|en_camino|entregado`
- `limit`, `offset` — paginación

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "restauranteId": "uuid",
      "repartidorId": "uuid",
      "estado": "en_camino",
      "direccionEntrega": "Cra 5 # 20-30, Apto 304",
      "total": 29.25,
      "createdAt": "2026-04-13T10:30:00Z",
      "updatedAt": "2026-04-13T10:35:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 8
  }
}
```

- `200 OK`: Pedidos asignados
- `403 Forbidden`: Repartidor solo puede ver sus propios
- `404 Not Found`: Repartidor no existe

---

### 🔟 Listar Pedidos Disponibles (Para Repartidor)

**GET** `/orders/available?limit=10&offset=0`

**Roles:** `repartidor` | `admin`

**Descripción:** Lista todos los pedidos en estado `pendiente` que aún no tienen repartidor asignado. Los repartidores usan este endpoint para descubrir pedidos disponibles para aceptar.

**Query Params:**
- `limit` — items por página (default: 10, max: 100)
- `offset` — para paginación (default: 0)

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "restauranteId": "uuid",
      "repartidorId": null,
      "estado": "pendiente",
      "subtotal": 27.25,
      "costoEntrega": 2.00,
      "total": 29.25,
      "direccionEntrega": "Cra 5 # 20-30, Apto 304",
      "createdAt": "2026-04-13T10:30:00Z",
      "updatedAt": "2026-04-13T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 5
  }
}
```

- `200 OK`: Lista de pedidos disponibles
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Solo repartidor o admin

## Estructura de Errores

Todos los errores retornan un objeto estándar:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Descripción del error en lenguaje natural",
  "details": {
    "field": "items",
    "issue": "must not be empty"
  },
  "timestamp": "2026-04-13T10:30:00Z",
  "requestId": "uuid"
}
```

### Códigos de Error

| HTTP | Code | Descripción |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Entrada inválida |
| 400 | `INVALID_STATE_TRANSITION` | Cambio de estado no permitido |
| 401 | `UNAUTHORIZED` | Token inválido o expirado |
| 403 | `FORBIDDEN` | Usuario no tiene permisos |
| 404 | `NOT_FOUND` | Recurso no existe |
| 409 | `CONFLICT` | Conflicto de estado o concurrencia |
| 500 | `INTERNAL_ERROR` | Error de servidor |

---

## Eventos RabbitMQ

Todos los eventos se publican en un **exchange `orders`** con routing keys específicos.

### order.created
Cuando se crea un nuevo pedido.
```json
{
  "eventId": "uuid",
  "eventType": "order.created",
  "timestamp": "2026-04-13T10:30:00Z",
  "data": {
    "orderId": "uuid",
    "userId": "uuid",
    "restauranteId": "uuid",
    "subtotal": 27.25,
    "costoEntrega": 2.00,
    "total": 29.25,
    "estado": "pendiente",
    "items": [
      { "productId": "uuid", "nombre": "Hamburguesa", "cantidad": 2 }
    ]
  }
}
```

### order.assigned
Cuando un repartidor acepta el pedido.
```json
{
  "eventId": "uuid",
  "eventType": "order.assigned",
  "timestamp": "2026-04-13T10:31:00Z",
  "data": {
    "orderId": "uuid",
    "repartidorId": "uuid",
    "estado": "aceptado"
  }
}
```

### order.status.changed
Cada vez que cambia el estado del pedido.
```json
{
  "eventId": "uuid",
  "eventType": "order.status.changed",
  "timestamp": "2026-04-13T10:35:00Z",
  "data": {
    "orderId": "uuid",
    "fromEstado": "aceptado",
    "toEstado": "en_camino",
    "changedBy": "uuid-repartidor",
    "estado": "en_camino"
  }
}
```

### order.delivered
Cuando un pedido se marca como entregado.
```json
{
  "eventId": "uuid",
  "eventType": "order.delivered",
  "timestamp": "2026-04-13T10:40:00Z",
  "data": {
    "orderId": "uuid",
    "userId": "uuid",
    "repartidorId": "uuid",
    "restauranteId": "uuid",
    "deliveredAt": "2026-04-13T10:40:00Z"
  }
}
```

### order.cancelled
Cuando se cancela un pedido.
```json
{
  "eventId": "uuid",
  "eventType": "order.cancelled",
  "timestamp": "2026-04-13T10:40:00Z",
  "data": {
    "orderId": "uuid",
    "cancelledBy": "uuid-usuario",
    "reason": "Cambié de opinión",
    "revertedFrom": "pendiente"
  }
}
```

---

## Integración con Microservicios

### 🔗 User Service (Verificación de Repartidor)

**Cuándo:** Al aceptar un pedido, verificar que repartidor existe y está disponible.

**Recomendación:** Consulta **sincrónica** (HTTP) para operaciones críticas.

```
GET /users/{repartidorId}/availability
Response: { "isAvailable": true, "role": "repartidor" }
```

Manejo de fallo: Si user-service no responde, retornar `503 Service Unavailable`.

### 🔗 Restaurant Service (Validación de Productos)

**Cuándo:** Al crear un pedido, validar que productos existen y están disponibles.

**Recomendación:** Consulta sincrónica.

```
POST /products/validate
Body: [{ "productId": "uuid", "quantity": 2, "expectedPrice": 12.75 }]
Response: { "valid": true, "validated": [...] }
```

Manejo de fallo: Si producto no existe o precio cambió, retornar `400 Bad Request`.

---

## Buenas Prácticas

### 1️⃣ Transacciones

Crear pedido + items + log en **una única transacción**:
```go
// Pseudocódigo
tx := db.BeginTx()
  defer tx.Rollback()
  
  // Crear pedido
  pedido := Pedido{ ... }
  tx.Create(&pedido)
  
  // Crear items
  for _, item := range items {
    tx.Create(&PedidoItem{ pedidoId: pedido.ID, ... })
  }
  
  // Crear log
  tx.Create(&PedidoEstadoLog{ pedidoId: pedido.ID, toEstado: "pendiente" })
  
  tx.Commit()
```

### 2️⃣ Validaciones Estrictas

- **Cantidad:** min 1, max 999 per item
- **Total de items:** max 100 per orden
- **Precio:** min 0, max 99999.99
- **Dirección:** min 5 chars, max 200 chars

### 3️⃣ Idempotencia

Endpoints que cambian estado deben aceptar un `idempotencyKey` opcional:
```json
{
  "toEstado": "en_camino",
  "idempotencyKey": "uuid"
}
```

Si se recibe la misma key, retornar el resultado anterior sin ejecutar de nuevo.

### 4️⃣ Eventos Only After Commit

Publicar eventos en RabbitMQ **SOLO** después de confirmar la transacción DB:
```go
// ✅ CORRECTO
tx.Commit()
publishToRabbitMQ(order.created)

// ❌ INCORRECTO
publishToRabbitMQ(order.created)
tx.Commit()  // qué pasa si falla?
```

### 5️⃣ Testing

Tests unitarios para:
- ✅ Creación de pedido con cálculo de totales
- ✅ Validaciones de entrada
- ✅ Transiciones de estado permitidas/prohibidas
- ✅ Autorización por rol
- ✅ Casos de error (pedido no existe, repartidor no disponible, etc.)

Cobertura mínima: **70% de los endpoints**.

---

## Escenarios de Flujo Completo

### Happy Path: Usuario → Repartidor → Entrega

```
1. Usuario: POST /orders
   → Pedido creado en estado "pendiente"
   → Evento: order.created

2. Admin/Sistema: GET /orders/active
   → Pedido visible en activos

3. Repartidor: POST /orders/{id}/accept
   → Estado cambia a "aceptado"
   → Evento: order.assigned, order.status.changed

4. Repartidor: POST /orders/{id}/status { "toEstado": "en_camino" }
   → Estado cambia a "en_camino"
   → Evento: order.status.changed

5. Usuario: GET /orders/{id}
   → Ve estado "en_camino"

6. Repartidor: POST /orders/{id}/status { "toEstado": "entregado" }
   → Estado cambia a "entregado"
   → Evento: order.delivered

7. Ratings-Service: Escucha order.delivered
   → Permite que usuario califique
```

### Error Path: Cancelación

```
1. Usuario: POST /orders/{id}/cancel
   → Solo si estado == "pendiente"
   → Evento: order.cancelled

2. Repartidor: GET /orders/active
   → No ve el pedido cancelado
```

---
