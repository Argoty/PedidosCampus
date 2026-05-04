# Frontend-Backend — Análisis de Coherencia de Endpoints

## Resumen Ejecutivo

Este documento compara los endpoints que el frontend (`Next.js`) consume contra los que los microservicios backend exponen. El foco está en discrepancias de rutas, métodos HTTP, y flujos de negocio. El Gateway (puerto 3000) actúa como reverse proxy: inyecta `x-service-token` en peticiones internas.

---

## Gateway — Mapeo de Rutas

| Ruta Gateway | Servicio Destino | Puerto |
|--------------|-----------------|--------|
| `/auth/*` | auth-service | 3001 |
| `/api/profiles/*` | user-service | 5000 |
| `/restaurants/*` | restaurant-service | 8001 (prefijo `/api/v1`) |
| `/orders/*` | order-service | 8002 |
| `/notifications/*` | notificaciones-worker | Cloudflare |
| `/ratings/*` | rating-service | 8003 |

**Nota**: Restaurant-service usa prefijo `/api/v1` internamente. El gateway monta `/restaurants` → `http://restaurant-service:8001/api/v1`.

---

## Comparación por Servicio

### 1. Auth Service

| Frontend (Método) | Endpoint Consumido | Backend_EXPonía (Archivo) | STATUS |
|------------------|-------------------|------------------------|--------|
| POST | `/auth/register` | ✅Existe (API_AUTH.md) | **OK** |
| POST | `/auth/login` | ✅Existe (API_AUTH.md) | **OK** |
| POST | `/auth/refresh` | ✅Existe (API_AUTH.md) | **OK** |
| POST | `/auth/logout` | ✅Existe (API_AUTH.md) | **OK** |

**Gateway**: Monta `/auth` → `http://auth-service:3001`.

**Flujo Coherente**: ✅ Registro, login, refresh, logout cubiertos.

---

### 2. User Service (Profiles)

| Frontend (Método) | Endpoint Consumido | Backend_EXPonía (Archivo) | STATUS |
|------------------|-------------------|------------------------|--------|
| GET | `/api/profiles/me` | ✅Existe (API.md) | **OK** |
| POST | `/api/profiles` | ✅Existe (API.md) | **OK** |
| PATCH | `/api/profiles/me` | ✅Existe (API.md) | **OK** |
| GET | `/api/profiles?limit=50` | ✅Existe (API.md) | **OK** |
| GET | `/api/profiles/me/availability` | ✅Existe (API.md) | **OK** |
| POST | `/api/profiles/me/availability` | ✅Existe (API.md) | **OK** |
| POST | `/api/profiles/{profileId}/activate` | ✅Existe (API.md) | **OK** |
| POST | `/api/profiles/{profileId}/deactivate` | ✅Existe (API.md) | **OK** |

**Gateway**: Monta `/api/profiles` → `http://user-service:5000`.

**Discrepancia Detectada**: Ninguna. Endpoints alineados.

---

### 3. Restaurant Service

| Frontend (Método) | Endpoint Consumido | Backend_EXPonía (Archivo) | STATUS |
|------------------|-------------------|------------------------|--------|
| GET | `/restaurants` | ✅Existe (API.md) | **OK** |
| GET | `/restaurants/{id}` | ✅Existe (API.md) | **OK** |
| POST | `/restaurants` | ✅Existe (API.md) | **OK** |
| POST | `/restaurants/{id}/activate` | ✅Existe (API.md) | **OK** |
| POST | `/restaurants/{id}/deactivate` | ✅Existe (API.md) | **OK** |
| POST | `/restaurants/{id}/products` | ✅Existe (API.md) | **OK** |

**Gateway**: Monta `/restaurants` → `http://restaurant-service:8001/api/v1` (agrega prefijo).

**Discrepancia**: El frontend usa `/restaurants/{id}/{action}` (donde action = activate/deactivate). El backend expone paths explícitos `/activate` y `/deactivate`. El frontend concatena directamente: `/restaurants/${id}/${action}` → `/restaurants/uuid/activate`. Esto **NO** coincide con la API del backend: debe ser `/restaurants/{id}/activate`.

**Propuesta Fix en Frontend**: Cambiar de:
```typescript
apiFetch(`/restaurants/${id}/${action}`, { method: 'POST' })
```
a:
```typescript
apiFetch(`/restaurants/${id}/${action === 'activate' ? 'activate' : 'deactivate'}`, { method: 'POST' })
```
O mejor, usar paths explícitos.

---

### 4. Order Service

| Frontend (Método) | Endpoint Consumido | Backend_EXPonía (Archivo) | STATUS |
|------------------|-------------------|------------------------|--------|
| GET | `/orders` | ✅Existe (API.md) | **OK** |
| POST | `/orders` | ✅Existe (API.md) | **OK** |
| GET | `/orders/{id}` | ✅Existe (API.md) | **OK** |
| POST | `/orders/{id}/accept` | ✅Existe (API.md) | **OK** |
| POST | `/orders/{id}/status` | ✅Existe (API.md) | **OK** |
| POST | `/orders/{id}/cancel` | ✅Existe (API.md) | **OK** |
| GET | `/orders/available` | ✅Existe (API.md) | **OK** |
| GET | `/orders/active` | ✅Existe (API.md) | **OK** |
| GET | `/orders/deliverer/{repartidorId}` | ✅Existe (API.md) | **OK** |

**Gateway**: Monta `/orders` → `http://order-service:8002`.

**Discrepancia Detectada**: Ninguna directa. Todos los endpoints del frontend existen en el backend.

---

### 5. Rating Service

| Frontend (Método) | Endpoint Consumido | Backend_EXPonía (Archivo) | STATUS |
|------------------|-------------------|------------------------|--------|
| POST | `/ratings/restaurant` | ✅Existe (API.md) | **OK** |
| GET | `/ratings/restaurant/user/{userId}` | ✅Existe (API.md) | **OK** |
| POST | `/ratings/delivery` | ✅Existe (API.md) | **OK** |
| GET | `/ratings/delivery/user/{userId}` | ✅Existe (API.md) | **OK** |

**Gateway**: Monta `/ratings` → `http://rating-service:8003`.

**Nota**: El rating-service genera `user_id` aleatorio (mock). No extrae del JWT actualmente. Esto es una **limitación conocida** (API.md indica "futuro: extraer del JWT").

---

### 6. Notificaciones Service

| Frontend (Método) | Endpoint Consumido | Backend_EXPonía | STATUS |
|------------------|-------------------|---------------|--------|
| GET | `/notifications` | ⚠️No documentado (Worker) | **?** |
| PATCH | `/notifications/{id}/leer` | ⚠️No documentado (Worker) | **?** |

**Estado**: El Worker (`notificaciones-service`) corre como Cloudflare Worker. No hay API.md para este servicio. Se asume endpoint existe por consumo del frontend. **Documentación pendiente**.

---

## Flujos de Negocio — Análisis de Compatibilidad

### Flujo 1: Registro + Login

```
Frontend: POST /auth/register → Gateway → Auth-Service (3001)
Frontend: POST /auth/login
Frontend: GET /api/profiles/me
```

**Compatibilidad**: ✅ El perfil se crea automáticamente en User Service al registrar (side effect documentado en API_AUTH.md).

---

### Flujo 2: Ver Restaurantes y Hacer Pedido

```
Frontend: GET /restaurants
Frontend: GET /restaurants/{id}
Frontend: POST /orders (carrito)
Frontend: GET /orders (historial)
```

**Compatibilidad**: ✅ Order-service valida productos contra restaurant-service. Flujo coherente.

---

### Flujo 3: Ciclo del Repartidor

```
Frontend (repartidor): GET /orders/available
Frontend: POST /orders/{id}/accept
Frontend: POST /orders/{id}/status (en_camino → entregado)
Frontend: GET /orders/deliverer/{id}
```

**Compatibilidad**: ✅ Order-service valida disponibilidad del repartidor contra user-service (RFC-PED-04).

---

### Flujo 4: Calificaciones (Post-Entrega)

```
Frontend: GET /ratings/restaurant/user/{userId}
Frontend: POST /ratings/restaurant
Frontend: GET /ratings/delivery/user/{userId}
Frontend: POST /ratings/delivery
```

**Compatibilidad**: ⚠️ Rating-service genera user_id aleatorio (no extrae del JWT). Las calificaciones se crean pero no están vinculadas al usuario real. **Esto es un bug-known**: el frontend envía el user.id del JWT, pero el backend lo ignora.

---

### Flujo 5: Notificaciones

```
Frontend: GET /notifications
Frontend: PATCH /notifications/{id}/leer
```

**Compatibilidad**: ⚠️ Sin API.md del worker. No se puede verificar. Requiere documentación.

---

## Resumen de Discrepancias

| # | Área | Problema | Severidad | Recomendación |
|---|------|---------|----------|---------------|
| 1 | Restaurant | Frontend usa `/restaurants/{id}/${action}` vs backend `/restaurants/{id}/activate` | Media | Normalizar paths en frontend |
| 2 | Ratings | Backend ignora user_id del JWT (usa uuid aleatorio) | Alta | Implementar extracción de JWT en rating-service |
| 3 | Notificaciones | Sin API.md del worker | Media | Crear API.md para worker |

---

## Archivos de Referencia

| Servicio | Archivo Documentación |
|----------|---------------------|
| Auth | `microservices/auth-service/API_AUTH.md` |
| User | `microservices/user-service/doc/API.md` |
| Restaurant | `microservices/restaurant-service/doc/API.md` |
| Order | `microservices/order-service/doc/API.md` |
| Rating | `microservices/rating-service/API.md` |
| Gateway | `microservices/gateway-service/src/app.module.ts` |
| API Client | `frontend/src/lib/api.ts` |

---

*Documento generado: Mayo 2026*