# PedidosCampus — Mapa de Operaciones UI ↔ Microservicios

> Fuente verificada: `docs/RequisitosFuncionales.md`, `microservices/*/API.md`, esquemas Prisma y endpoints reales en código.
> Objetivo: mapear operaciones UI → Gateway → microservicios, detectar faltantes y dependencias, y proponer oportunidades RabbitMQ.

---

## 1) Contexto de arquitectura (resumen)

- **Gateway** (NestJS) enruta por ruta y valida JWT (`/auth`, `/api/profiles`, `/restaurants`, `/orders`, `/ratings`, `/notifications`).
- **Auth** gestiona JWT + refresh tokens.
- **User Service** gestiona perfiles, disponibilidad y reservas atómicas.
- **Restaurant Service** maneja restaurantes y productos (con validación batch para pedidos).
- **Order Service** maneja el ciclo de pedidos y publica eventos RabbitMQ.
- **Notificaciones** (Cloudflare Worker) recibe POST `/notifications` y sirve listados/lecturas.
- **Rating Service** CRUD de calificaciones.

---

## 2) Operaciones UI → Endpoints (por módulo funcional)

### 2.1 Autenticación y sesión

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Registro | `/auth` | Auth | `POST /auth/register` | Retorna access token + refresh cookie. |
| Login | `/auth` | Auth | `POST /auth/login` | Retorna access token + refresh cookie. |
| Refresh sesión | `/auth` | Auth | `POST /auth/refresh` | Requiere refresh cookie HttpOnly. |
| Logout | `/auth` | Auth | `POST /auth/logout` | Revoca refresh token. |
| Perfil auth básico | `/auth` | Auth | `GET /auth/me` | Devuelve datos de AuthUser. |

**UI impact:**
- Guardar `accessToken` en memoria (no localStorage ideal). Refresh vía cookie.
- Manejar expiración: refresh y reintento de request.

---

### 2.2 Perfil de usuario / repartidor

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Ver mi perfil | `/api/profiles` | User | `GET /api/profiles/me` | JWT requerido. |
| Crear perfil (post-registro) | `/api/profiles` | User | `POST /api/profiles` | Extrae `sub` del JWT. |
| Editar mi perfil | `/api/profiles` | User | `PATCH /api/profiles/me` | JWT requerido. |

**Repartidor:**

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Ver mi disponibilidad | `/api/profiles` | User | `GET /api/profiles/me/availability` | JWT + rol repartidor. |
| Cambiar disponibilidad | `/api/profiles` | User | `POST /api/profiles/me/availability` | TODO: evento RabbitMQ. |

**Admin (backoffice):**

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Listar perfiles | `/api/profiles` | User | `GET /api/profiles` | Admin only. |
| Activar/Desactivar perfil | `/api/profiles` | User | `POST /api/profiles/{id}/activate` / `deactivate` | Admin only. |
| Editar perfil por ID | `/api/profiles` | User | `PATCH /api/profiles/{id}` | Admin only. |
| Eliminar perfil | `/api/profiles` | User | `DELETE /api/profiles/{id}` | Admin only. |

**Internal (Gateway-only):**

| Operación | Gateway | Microservicio | Endpoint | Notas |
|---|---|---|---|---|
| Listar repartidores disponibles | `/api/profiles` | User | `GET /api/profiles/delivery` | Requiere `X-Client: gateway`. |
| Reserva atómica | `/api/profiles` | User | `POST /api/profiles/{id}/reserve` | Requiere `X-Client: gateway`. |
| Liberar reserva | `/api/profiles` | User | `POST /api/profiles/{id}/release` | Requiere `X-Client: gateway`. |

---

### 2.3 Restaurantes y productos

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Listar restaurantes (público) | `/restaurants` | Restaurant | `GET /restaurants` | Public (Gateway deja pasar GET). |
| Buscar restaurantes | `/restaurants` | Restaurant | `GET /restaurants?q=` | Public. |
| Ver restaurante + menú | `/restaurants` | Restaurant | `GET /restaurants/{id}` | `include_unavailable=false` por defecto. |
| Listar productos por restaurante | `/restaurants` | Restaurant | `GET /restaurants/{id}/products` | Public. |

**Admin:**

| Operación UI | Gateway | Microservicio | Endpoint | Notas |
|---|---|---|---|---|
| Crear restaurante | `/restaurants` | Restaurant | `POST /restaurants` | Admin JWT. |
| Editar restaurante | `/restaurants` | Restaurant | `PATCH /restaurants/{id}` | Admin JWT. |
| Activar/Desactivar | `/restaurants` | Restaurant | `POST /restaurants/{id}/activate` / `deactivate` | Admin JWT. |
| CRUD productos | `/restaurants` | Restaurant | `POST /restaurants/{id}/products` / `PATCH /products/{id}` / `DELETE /products/{id}` | Admin JWT. |

---

### 2.4 Pedidos (usuario, repartidor, admin)

**Usuario:**

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Crear pedido | `/orders` | Order | `POST /orders` | **Depende** Restaurant `POST /products/validate-batch`. |
| Ver pedido (detalle) | `/orders` | Order | `GET /orders/{id}` | Owner. |
| Ver historial de pedidos | `/orders` | Order | `GET /orders?limit=&offset=&estado=` | Owner. |
| Cancelar pedido | `/orders` | Order | `POST /orders/{id}/cancel` | Solo `pendiente`. |
| Ver historial de estados | `/orders` | Order | `GET /orders/{id}/history` | Owner. |

**Repartidor:**

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Ver pedidos asignados | `/orders` | Order | `GET /orders/deliverer/{repartidorId}` | Repartidor solo propio. |
| Aceptar pedido | `/orders` | Order | `POST /orders/{id}/accept` | **Depende** User availability. |
| Cambiar estado | `/orders` | Order | `POST /orders/{id}/status` | Solo asignado. |

**Admin:**

| Operación UI | Gateway | Microservicio | Endpoint | Notas |
|---|---|---|---|---|
| Listar pedidos activos | `/orders` | Order | `GET /orders/active` | Admin. |
| Ver historial completo | `/orders` | Order | `GET /orders?limit=&offset=` | Admin (todos). |

---

### 2.5 Calificaciones

| Operación UI | Gateway | Microservicio | Endpoint | Notas/Dependencias |
|---|---|---|---|---|
| Calificar restaurante | `/ratings` | Rating | `POST /ratings/restaurant` | Solo pedido entregado (lógica externa). |
| Calificar repartidor | `/ratings` | Rating | `POST /ratings/delivery` | Solo pedido entregado (lógica externa). |
| Ver mis calificaciones | `/ratings` | Rating | `GET /ratings/restaurant/user/:userId` y `/ratings/delivery/user/:userId` | JWT requerido. |
| Ver calificaciones restaurante | `/ratings` | Rating | `GET /ratings/restaurant/restaurant/:restauranteId` | Público o JWT? (doc dice JWT). |
| Ver stats restaurante | `/ratings` | Rating | `GET /ratings/stats/restaurant/:restauranteId` | JWT requerido. |
| Ver stats repartidor | `/ratings` | Rating | `GET /ratings/stats/delivery/:repartidorId` | JWT requerido. |

---

### 2.6 Notificaciones

| Operación UI | Gateway | Microservicio | Endpoint | Notas |
|---|---|---|---|---|
| Listar mis notificaciones | `/notifications` | Notif Worker | `GET /notifications/{userId}` | Requiere `x-service-token` (Gateway lo inyecta). |
| Marcar como leída | `/notifications` | Notif Worker | `PATCH /notifications/{id}/leer` | Requiere `x-service-token`. |
| (interno) Crear notificación | `/notifications` | Notif Worker | `POST /notifications` | Lo ideal es que lo haga un consumer RabbitMQ. |

---

## 3) Dependencias críticas entre microservicios

### Sincrónicas (HTTP)

1) **Order → Restaurant**
   - Validación de items y precios: `POST /products/validate-batch` (Restaurant).
   - Crítico para `POST /orders`.

2) **Order → User**
   - Verificación de repartidor disponible (documentado en Order API).
   - Recomendado usar: `GET /api/profiles/delivery` o `POST /api/profiles/{id}/reserve`.

3) **Gateway → Todos**
   - Inyecta `x-service-token` para internos.
   - Valida JWT (excepto rutas públicas y health).

### Asíncronas (eventos)

- **Order → RabbitMQ**: `order.created`, `order.assigned`, `order.status.changed`, `order.delivered`, `order.cancelled`.
- **User → RabbitMQ**: eventos de disponibilidad/registro (planificados, TODO en código).
- **Restaurant → RabbitMQ**: `product.updated`, `product.created`, etc. (documentado, no implementado en código).
- **Rating** debería consumir `order.delivered` (habilitar UI de rating).
- **Notificaciones** debería consumir eventos (hoy simula por HTTP POST manual).

---

## 4) Faltantes / inconsistencias detectadas (verificación con evidencia)

1) **Gateway y rutas reales**
   - Gateway enruta `/restaurants` hacia `restaurant-service`, pero el servicio usa prefijo **`/api/v1`** (FastAPI). 
   - Esto implica que `GET /restaurants` desde Gateway NO llega a `/api/v1/restaurants`.
   - **Evidencia:** `restaurant-service/app/api/v1/endpoints/*.py` y `app/main.py` usan `/api/v1`.
   - **Impacto UI:** todas las llamadas a restaurantes fallan si Gateway no reescribe la ruta.

2) **Order → User: disponibilidad**
   - API.md de Order recomienda `GET /users/{repartidorId}/availability`, pero **en User Service real no existe**. 
   - Lo real es: `GET /api/profiles/me/availability` (para el propio repartidor) y endpoints internos `delivery/reserve/release`.
   - **Impacto:** aceptar pedido debería consultar/ reservar vía `profiles/*` (internal), no `/users/*`.

3) **RabbitMQ en User/Restaurant/Rating/Notif**
   - **User Service** tiene TODOs para publicar eventos (`availability`, `profile.*`).
   - **Restaurant Service** documenta eventos, pero no se ven publishers en código.
   - **Rating Service** menciona que podría escuchar `order.delivered`, pero no hay consumer.
   - **Notificaciones** hoy recibe HTTP (simulación), no consume RabbitMQ.

4) **Notificaciones: autenticación**
   - Worker exige `x-service-token`. El Gateway lo inyecta, pero sólo si el tráfico pasa por él.
   - UI debe consumir **vía Gateway**, no directo al Worker.

---

## 5) Oportunidades claras para RabbitMQ (con tradeoffs)

### A) Order → Notificaciones (RECOMENDADO)
- **Evento:** `order.created`, `order.status.changed`, `order.delivered`, `order.cancelled`.
- **Uso:** Notif worker consume y crea notificaciones por usuario/repartidor.
- **Pros:** UI siempre tiene notificaciones consistentes, desacople total.
- **Contras:** más infraestructura; requiere consumer estable (no Worker directo).

### B) Order → Rating (RECOMENDADO)
- **Evento:** `order.delivered`.
- **Uso:** Rating habilita ventana de calificación o pre-registración.
- **Pros:** el rating sabe qué pedidos están entregados sin consulta sincrónica.
- **Contras:** requiere idempotencia para no duplicar habilitaciones.

### C) Restaurant → Order (OPCIONAL)
- **Evento:** `product.updated` (precio, disponibilidad).
- **Uso:** Order invalida caches o bloquea pedidos con productos desactivados.
- **Pros:** consistencia eventual; reduce validaciones repetidas.
- **Contras:** complejidad si el order-service no cachea productos.

### D) User → Order (OPCIONAL)
- **Evento:** `repartidor.availability.changed`.
- **Uso:** Order mantiene lista interna de repartidores disponibles.
- **Pros:** reduce llamadas sincrónicas.
- **Contras:** riesgo de inconsistencias si no se maneja TTL/reservas.

**Tradeoff general**
- HTTP sincrónico: simple, fuerte consistencia, pero más acoplamiento y latencia.
- Eventos RabbitMQ: desacople y resiliencia, pero consistencia eventual y necesidad de consumidores confiables.

---

## 6) Recomendaciones de integración (mínimo viable)

1) **Corregir enrutamiento Gateway → Restaurant Service**
   - Opción A: agregar `/api/v1` en gateway (rewrite).
   - Opción B: cambiar prefijo de FastAPI a `/`.
   - Tradeoff: A evita tocar micro; B simplifica rutas públicas pero requiere refactor.

2) **Actualizar validación de repartidor en Order Service**
   - Usar endpoints reales de User Service (`/api/profiles/{id}/reserve` + `/release`).
   - Mantener sincronía para operaciones críticas.

3) **RabbitMQ mínimo**
   - Consumidor para `order.*` que cree notificaciones en Worker (o un micro intermedio).
   - Consumidor para `order.delivered` en Rating.

4) **UI**
   - Consumir **siempre** a través del Gateway.
   - No exponer `userId` en respuestas públicas (User Service lo cuida, mantenerlo en UI solo para requests internas).

---

## 7) Checklist para UI + Gateway

**Rutas públicas (GET sin JWT):**
- `/restaurants` (listado y detalle)
- `/restaurants/{id}/products` (si se decide exponer)

**Rutas protegidas (JWT):**
- `/orders/*`, `/api/profiles/*`, `/ratings/*`, `/auth/me`.

**Rutas internas (solo Gateway):**
- `/api/profiles/delivery`, `/api/profiles/{id}/reserve`, `/api/profiles/{id}/release`.

---

## 8) Fuentes verificados

- `docs/RequisitosFuncionales.md`
- `microservices/order-service/doc/API.md`
- `microservices/user-service/doc/API.md`
- `microservices/restaurant-service/doc/API.md`
- `microservices/rating-service/API.md`
- `microservices/*/doc/*-schema.prisma`
- `microservices/gateway-service/src/app.module.ts`
- `microservices/restaurant-service/app/api/v1/endpoints/*.py`
- `microservices/user-service/src/Controllers/ProfilesController.cs`
