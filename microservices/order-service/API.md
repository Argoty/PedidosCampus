# Order Service — API

Este documento describe los endpoints, contratos, eventos y reglas del microservicio Pedidos (order-service) para implementar el ciclo de vida de pedidos según los RequisitosFuncionales.md.

Autenticación
- Todos los endpoints protegidos requieren JWT válido. El Gateway valida el token y lo reenvía.
- Roles relevantes: `usuario`, `repartidor`, `admin`.

Modelos relevantes (resumen del schema)
- Pedido: id, userId, restauranteId, repartidorId?, estado (pendiente|aceptado|en_camino|entregado), subtotal, costoEntrega, total, direccionEntrega, createdAt, updatedAt
- PedidoItem: id, pedidoId, productId, nombre, precioUnit, cantidad, subtotal
- PedidoEstadoLog: id, pedidoId, fromEstado, toEstado, changedById, createdAt

Endpoints HTTP

1) Crear pedido
- POST /orders
- Roles: usuario
- Body (application/json):
  {
    "userId": "uuid",           // tomado del JWT idealmente
    "restauranteId": "uuid",
    "direccionEntrega": "string",
    "items": [
      { "productId": "uuid", "nombre": "string", "precioUnit": "decimal", "cantidad": 1 }
    ]
  }
- Validaciones:
  - items no vacío, cantidad >= 1
  - precioUnit >= 0
  - direccionEntrega presente
  - userId debe coincidir con sujeto del JWT
- Lógica:
  - calcular subtotal = sum(precioUnit * cantidad)
  - costoEntrega: política configurable (por ahora fijo o 0)
  - total = subtotal + costoEntrega
  - crear Pedido con estado `pendiente`, crear PedidoItem(s) y un PedidoEstadoLog inicial (fromEstado = null, toEstado = pendiente)
  - publicar evento RabbitMQ: `order.created` con payload del pedido (id, userId, restauranteId, subtotal, total, estado, createdAt)
- Respuestas:
  - 201 Created: { "id": "uuid", "estado": "pendiente", ... }
  - 400 Bad Request: { "error": "detalle" }

2) Listar pedidos del usuario (historial)
- GET /orders?userId={uuid}&limit=&offset=&estado=
- Roles: usuario (solo sus pedidos) o admin (todos)
- Parámetros:
  - userId opcional para admin; para usuario se ignora y se usa el JWT
  - filtros: estado
  - paginación: limit, offset
- Respuesta 200: lista paginada de pedidos con items y estado actual

3) Obtener pedido por id
- GET /orders/{orderId}
- Roles: usuario (si owner), repartidor (si asignado) o admin
- Respuesta 200: objeto Pedido con items y historial de estados
  - 403 si no autorizado
  - 404 si no existe

4) Repartidor acepta pedido
- POST /orders/{orderId}/accept
- Roles: repartidor
- Body: { "repartidorId": "uuid" } (o usar sub del JWT)
- Precondiciones:
  - pedido.estado == pendiente
  - repartidor disponible (validar contra user-service vía sync/async - ver sección Integración)
- Efectos:
  - asignar repartidorId, cambiar estado a `aceptado`
  - insertar PedidoEstadoLog
  - publicar evento `order.status.changed` y `order.assigned`
- Respuestas: 200 ok con pedido actualizado, 409 si estado no es pendiente

5) Actualizar estado del pedido (por repartidor)
- POST /orders/{orderId}/status
- Roles: repartidor (asignado) o admin
- Body: { "toEstado": "aceptado|en_camino|entregado" }
- Reglas:
  - transiciones permitidas: pendiente -> aceptado; aceptado -> en_camino; en_camino -> entregado
  - validar que quien realiza la acción es el repartidor asignado (o admin)
  - al cambiar a `entregado` registrar timestamp y opcionalmente generar evento para calificaciones
- Efectos:
  - crear PedidoEstadoLog con fromEstado y toEstado
  - actualizar pedido.estado
  - publicar evento `order.status.changed` con { orderId, fromEstado, toEstado, changedBy }
- Respuestas: 200 ok, 400/409 en transiciones inválidas

6) Listar pedidos activos (admin)
- GET /orders/active?limit=&offset=&restauranteId=&estado=
- Roles: admin
- Permite filtros por restauranteId, estado

7) Cancelar pedido
- POST /orders/{orderId}/cancel
- Roles: usuario (owner si estado pendiente) o admin
- Reglas:
  - sólo se puede cancelar si estado == pendiente
  - crear log y publicar evento `order.cancelled`

Integración con otros microservicios
- user-service: verificar disponibilidad de repartidores y detalles de usuarios. Preferible consulta sync (HTTP) para verificación puntual (ej. aceptar pedido) y eventos async para cambios de disponibilidad.
- restaurant-service: validar productos y precios al crear pedido. Se recomienda validar precioUnit y nombre consultando el servicio de restaurantes (sync) para evitar inconsistencias.

Eventos RabbitMQ (exchange/queue)
- order.created — enviado cuando se crea un pedido
  - routing key: order.created
  - payload: pedido resumido + items
- order.assigned — cuando un repartidor acepta
  - payload: orderId, repartidorId
- order.status.changed — cada vez que cambia el estado
  - payload: orderId, fromEstado, toEstado, changedById, timestamp
- order.cancelled — cuando se cancela

Errores y códigos HTTP estándar
- 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error

Buenas prácticas de implementación
- Transacciones DB: crear pedido + items + log en la misma transacción
- Idempotencia: endpoints que cambian estado deben ser idempotentes por requestId opcional
- Validación estricta de entradas y límites (max items, max cantidad)
- Publicar eventos sólo cuando la transacción DB haya sido confirmada
- Tests unitarios para cálculos de totales y transiciones de estado

Escenarios de ejemplo
- Flujo de creación: usuario crea pedido -> evento order.created -> restaurante recibe (por integración futura) -> repartidor acepta (order.assigned) -> repartidor actualiza estados hasta entregado (order.status.changed)

---
