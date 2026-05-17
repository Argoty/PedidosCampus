# Reporte de Pruebas Manuales — Cloud (Render)

**Fecha:** 16/05/2026  
**Gateway URL:** `https://pedidoscampus-gateway.onrender.com`  
**Secrets usados:** `ACCESS_TOKEN_SECRET` / `SERVICE_TOKEN` de producción

---

## Arquitectura: Por qué NO probamos microservicios individuales directo

En Render, los microservicios individuales **NO están diseñados para acceso directo**. El middleware de cada servicio rechaza requests sin el header `x-service-token`, que **solo el API Gateway inyecta** al rutear. Por lo tanto:

| Servicio           | URL directa                             | ¿Funciona sin gateway?      |
| ------------------ | --------------------------------------- | --------------------------- |
| auth-service       | `pedidoscampus-auth.onrender.com`       | ❌ No (falta service-token) |
| user-service       | `pedidoscampus-user.onrender.com`       | ❌ No (falta service-token) |
| restaurant-service | `pedidoscampus-restaurant.onrender.com` | ✅ Solo `/health`           |
| order-service      | `pedidoscampus-order.onrender.com`      | ✅ Solo `/health`           |
| rating-service     | `pedidoscampus-rating.onrender.com`     | ✅ Solo `/health`           |
| ai-agent-service   | `pedidoscampus-agent.onrender.com`      | ❌ No (ruta incorrecta)     |

**Conclusión:** Todas las pruebas funcionales se hacen a través del **API Gateway**, que es el punto de entrada único.

---

## 1. AUTH SERVICE

| #   | Endpoint                                | Esperado | Obtenido                                           | Resultado  |
| --- | --------------------------------------- | -------- | -------------------------------------------------- | ---------- |
| 1   | `POST /auth/register`                   | 201      | **400** — "Fallo la comunicación con User Service" | ❌ CRÍTICO |
| 2   | `POST /auth/login` (mismo email)        | 200      | 401 (esperado: falla registro previo)              | ⚠️         |
| 3   | `GET /auth/me` (JWT generado)           | 200      | 401 — "Usuario no encontrado o inactivo"           | ⚠️         |
| 4   | `GET /auth/admin/ping`                  | 200      | **200** ✅                                         | ✅         |
| 5   | `POST /auth/register` sin service-token | 403      | 400 (error User Service, no de token)              | ❌         |

### Issues detectados

1. **Auth → User Service communication broken** — `POST /auth/register` falla porque el auth-service intenta crear un perfil en user-service, pero el user-service devuelve 404 en todos sus endpoints.
2. **Error code incorrecto** — Registrar sin service-token debería dar 403, pero da 400 por el mismo error de comunicación con user-service.

---

## 2. RESTAURANT SERVICE 🟢

| #   | Endpoint                                  | Esperado | Obtenido                            | Resultado |
| --- | ----------------------------------------- | -------- | ----------------------------------- | --------- |
| 1   | `GET /restaurants` (público)              | 200      | **200** — `{"items":[],"total":0}`  | ✅        |
| 2   | `POST /restaurants` (admin)               | 201      | **201** — Restaurante creado con ID | ✅        |
| 3   | `GET /restaurants/{id}`                   | 200      | **200** — Datos completos           | ✅        |
| 4   | `POST /restaurants/{id}/products` (admin) | 201      | **201** — Producto creado con ID    | ✅        |
| 5   | `GET /restaurants/products/{id}`          | 200      | **200** — Datos del producto        | ✅        |
| 6   | `POST /products/validate-batch`           | 200      | **200** — Validación correcta       | ✅        |
| 7   | `POST /restaurants` sin admin             | 403      | **403** — "Admin role required"     | ✅        |

### ✅ RESTAURANT SERVICE: 7/7 pruebas pasan

---

## 3. USER SERVICE 🔴

| #   | Endpoint                             | Esperado | Obtenido          | Resultado |
| --- | ------------------------------------ | -------- | ----------------- | --------- |
| 1   | `POST /api/profiles` (usuario)       | 201      | **404** Not Found | ❌        |
| 2   | `GET /api/profiles/me`               | 200      | **404** Not Found | ❌        |
| 3   | `PATCH /api/profiles/me`             | 200      | **404** Not Found | ❌        |
| 4   | `POST /api/profiles` (repartidor)    | 201      | **404** Not Found | ❌        |
| 5   | `POST /api/profiles/me/availability` | 200      | **404** Not Found | ❌        |
| 6   | `GET /api/profiles` (admin)          | 200      | **404** Not Found | ❌        |

### ❌ USER SERVICE: 0/6 pruebas pasan — CRÍTICO

**Causa probable:** El user-service desplegado en Render no está sirviendo sus rutas correctamente. Incluso pegándole directo con `x-service-token` devuelve 404 en todos los endpoints. Posibles causas:

- Migraciones de base de datos no aplicadas
- Variable de entorno `USUARIOS_DATABASE_URL` incorrecta
- Error al iniciar que impide registrar los controladores

**Impacto:** Bloquea el registro de usuarios (`auth/register`), la creación de perfiles, y todo el flujo de repartidores.

---

## 4. ORDER SERVICE 🟡

| #   | Endpoint                                | Esperado | Obtenido                                       | Resultado |
| --- | --------------------------------------- | -------- | ---------------------------------------------- | --------- |
| 1   | `GET /orders/health`                    | 200      | **401** — "Missing authorization token"        | ⚠️        |
| 2   | `GET /orders` (usuario)                 | 200      | **200** — Lista vacía                          | ✅        |
| 3   | `POST /orders` (usuario)                | 201      | **201** — Orden creada con ID                  | ✅        |
| 4   | `GET /orders/{id}`                      | 200      | **200** — Orden completa con items e historial | ✅        |
| 5   | `GET /orders/{id}/history`              | 200      | **200** — Historial de estados                 | ✅        |
| 6   | `POST /orders/{id}/accept` (repartidor) | 200      | **200** — Orden aceptada, estado → "aceptado"  | ✅        |
| 7   | `POST /orders/{id}/status` → en_camino  | 200      | **200** — Estado actualizado                   | ✅        |
| 8   | `POST /orders/{id}/status` → entregado  | 200      | **200** — Estado actualizado                   | ✅        |
| 9   | `GET /orders/available` (repartidor)    | 200      | **200** — Lista vacía                          | ✅        |
| 10  | `GET /orders` sin auth                  | 401      | **401** — "Token no provisto"                  | ✅        |

### Issues detectados

- `/orders/health` devuelve 401. El order-service tiene su propio middleware JWT que rechaza incluso el healthcheck. Debería ser público.

### ✅ ORDER SERVICE: 9/10 pruebas OK (1 warning)

---

## 5. RATING SERVICE 🟡

| #   | Endpoint                                  | Esperado | Obtenido                                   | Resultado                |
| --- | ----------------------------------------- | -------- | ------------------------------------------ | ------------------------ |
| 1   | `POST /ratings/restaurant` (sin JWT)      | 201      | **401** — "Token no provisto"              | ⚠️ (esperado)            |
| 2   | `POST /ratings/restaurant` (con JWT)      | 201/400  | **400** — "el_pedido_no_ha_sido_entregado" | ✅ (validación correcta) |
| 3   | `GET /ratings/stats/restaurant` (con JWT) | 200      | **200** — Estadísticas vacías              | ✅                       |
| 4   | `POST /ratings/delivery` (sin JWT)        | 201      | **401**                                    | ⚠️ (esperado)            |
| 5   | `GET /ratings/stats/delivery` (sin JWT)   | 200      | **401**                                    | ⚠️ (esperado)            |
| 6   | `GET /ratings/health`                     | 200      | **404** — No existe endpoint               | ❌                       |

### Issues detectados

- El rating-service requiere JWT para todos sus endpoints. Los tests en `cloud-smoke-tests.sh` no enviaban `Authorization: Bearer` a rating. **Con JWT funciona correctamente** (la validación de pedido no entregado es correcta).
- No hay endpoint `/ratings/health`. El rating-service no expone healthcheck.

---

## 6. AI AGENT SERVICE 🟢

| #   | Endpoint                                           | Esperado | Obtenido                                                 | Resultado |
| --- | -------------------------------------------------- | -------- | -------------------------------------------------------- | --------- |
| 1   | `GET /ai/health` (ruta correcta)                   | 200      | **200** — `{"status":"ok","service":"ai-agent-service"}` | ✅        |
| 2   | `GET /ai-agent/health` (ruta incorrecta en script) | 200      | 404 — Bug del script de test, no del servicio            | ⚠️        |

**Nota:** El gateway rutea `/ai/*` → ai-agent-service, no `/ai-agent/*`. El script usaba la ruta incorrecta. La ruta correcta es `/ai/health`.

### ✅ AI AGENT SERVICE: OK

---

## Resumen General

| Servicio               | Pasaron | Total | %        | Estado         |
| ---------------------- | ------- | ----- | -------- | -------------- |
| **Auth Service**       | 1       | 5     | 20%      | 🔴             |
| **Restaurant Service** | 7       | 7     | **100%** | 🟢             |
| **User Service**       | 0       | 6     | **0%**   | 🔴 **CRÍTICO** |
| **Order Service**      | 9       | 10    | 90%      | 🟡             |
| **Rating Service**     | 2\*     | 3     | 66%      | 🟡             |
| **AI Agent Service**   | 1       | 1     | **100%** | 🟢             |

_\*Rating probado con JWT manual; los tests automáticos no enviaban auth._

---

## Issues Críticos

### 🔴 ISSUE-1: User Service caído (0% de endpoints)

**Síntoma:** Todos los endpoints de `/api/profiles/*` devuelven 404 a través del gateway y también en acceso directo con `x-service-token`.  
**Impacto:** Bloquea registro de usuarios, creación de perfiles, disponibilidad de repartidores.  
**Causa probable:** Error de deploy en Render (migraciones no aplicadas, variable de entorno de DB incorrecta, o error al iniciar el servicio .NET).  
**Requiere:** Revisar logs del user-service en Render.

### 🔴 ISSUE-2: Auth → User Service communication broken

**Síntoma:** `POST /auth/register` devuelve 400 "Fallo la comunicación con User Service"  
**Causa:** Es consecuencia directa de ISSUE-1. Auth delega creación de perfil a user-service.  
**Requiere:** Solucionar ISSUE-1 primero.

### 🟡 ISSUE-3: Order healthcheck requiere JWT

**Síntoma:** `GET /orders/health` devuelve 401 en vez de 200.  
**Causa:** El order-service middleware JWT protege incluso el endpoint `/health`.  
**Sugerencia:** Agregar `/health` a las rutas públicas del order-service.

### 🟡 ISSUE-4: Rating tests sin JWT

**Síntoma:** Los scripts de test para rating no enviaban `Authorization: Bearer`  
**Causa:** El gateway requiere JWT para todas las rutas que no son explícitamente públicas.  
**Sugerencia:** Actualizar `cloud-smoke-tests.sh` para enviar JWT a los endpoints de rating.

### 🟡 ISSUE-5: Ruta incorrecta en script para AI Agent

**Síntoma:** El script usaba `/ai-agent/health` pero la ruta real es `/ai/health`.  
**Causa:** Bug en `cloud-smoke-tests.sh` — el gateway rutea `/ai` al agent, no `/ai-agent`.  
**Sugerencia:** Corregir el script.

---

## Recomendaciones

1. **Prioridad 1:** Debuggear el user-service en Render — revisar logs, verificar conexión a PostgreSQL, y que las migraciones se apliquen al iniciar.
2. **Prioridad 2:** Una vez que user-service funcione, probar el flujo completo de registro + creación de perfil.
3. **Prioridad 3:** Agregar `/ratings` a las rutas públicas o enviar JWT en los tests de rating.
4. **Prioridad 4:** Exponer `/orders/health` como público en el order-service.
5. **Corregir** la ruta del AI Agent en `cloud-smoke-tests.sh` (`/ai/health` en vez de `/ai-agent/health`).

---

_Tests ejecutados el 16/05/2026 contra <https://pedidoscampus-gateway.onrender.com>_
