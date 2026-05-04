# API Gateway - Resumen de Pruebas Manuales

## Estado: Mayo 2026

### Servicios que FUNCIONAN correctamente:

#### Restaurant Service ✅
- GET /restaurants (público) - OK
- POST /restaurants (admin) - OK  
- GET /restaurants/{id} - OK
- PATCH /restaurants/{id} - OK
- POST /restaurants/{id}/activate - OK
- POST /restaurants/{id}/deactivate - OK
- POST /restaurants/{id}/products (admin) - OK
- GET /restaurants/{id}/products - OK
- GET /products/{id} - OK
- PATCH /products/{id} - OK
- DELETE /products/{id} - OK (soft-delete)
- POST /products/validate-batch - OK

#### Order Service ✅ (parcial)
- GET /orders (con JWT) - OK
- POST /orders (con JWT usuario) - OK si existe restaurant
- GET /orders/{id} (owner/repartidor) - OK
- GET /orders/{id}/history - OK
- POST /orders/{id}/accept (repartidor) - OK
- POST /orders/{id}/status (repartidor/admin) - OK
- POST /orders/{id}/cancel (owner si pendiente) - OK
- GET /orders/active (admin) - OK
- GET /orders/available (repartidor) - OK
- GET /orders/deliverer/{id} - OK

#### Rating Service ✅ (accesado directamente a puerto 8003)
- GET /health - OK
- POST /ratings/restaurant - OK
- GET /ratings/restaurant/{id} - OK
- GET /ratings/restaurant/user/{id} - OK
- GET /ratings/restaurant/restaurant/{id} - OK
- GET /ratings/stats/restaurant/{id} - OK
- PATCH /ratings/restaurant/{id} - OK
- DELETE /ratings/restaurant/{id} - OK
- Mismos endpoints para /ratings/delivery
- ⚠️ Rating de delivery requiere que pedido esté "entregado"

---

### Servicios con PROBLEMAS:

#### Auth Service ⚠️
- POST /auth/register - Falla porque user-service no funciona
- POST /auth/login - Requiere usuario existente
- GET /auth/me - Token no es validado correctamente por gateway
- GET /auth/admin/ping - Token no es validado correctamente
- **Problema**: Los JWT generados localmente no son aceptados por el gateway

#### User Service ❌ (BUG CONFIRMADO)
- Todos los endpoints retornan 500 Internal Server Error
- Error: "No authenticationScheme was specified"
- Causa raíz: Falta AddAuthentication() en Program.cs
- Afecta a TODO el servicio

#### Rating Service via Gateway ⚠️
- No accesible a través del gateway (middleware auth lo bloquea)
- Funciona directamente en puerto 8003
- Necesitaría agregar '/ratings' a rutas públicas del gateway

---

## Endpoints por Puerto

### Puerto 3000 (API Gateway)
| Método | Endpoint | Status | Notas |
|--------|----------|--------|-------|
| GET | /auth/register | ⚠️ | Requiere user-service |
| POST | /auth/login | ⚠️ | Requiere usuario existente |
| GET | /auth/me | ⚠️ | JWT no validado |
| GET | /auth/admin/ping | ⚠️ | JWT no validado |
| GET | /restaurants | ✅ | Público |
| POST | /restaurants | ✅ | Admin |
| GET | /restaurants/{id} | ✅ | Público |
| PATCH | /restaurants/{id} | ✅ | Admin |
| POST | /restaurants/{id}/activate | ✅ | Admin |
| POST | /restaurants/{id}/deactivate | ✅ | Admin |
| POST | /restaurants/{id}/products | ✅ | Admin |
| GET | /restaurants/{id}/products | ✅ | Público |
| GET | /restaurants/products/{id} | ✅ | Público |
| PATCH | /restaurants/products/{id} | ✅ | Admin |
| DELETE | /restaurants/products/{id} | ✅ | Admin |
| POST | /restaurants/products/validate-batch | ✅ | - |
| GET | /orders | ✅ | JWT requerido |
| POST | /orders | ✅ | JWT usuario |
| GET | /orders/{id} | ✅ | Owner/repartidor |
| GET | /orders/{id}/history | ✅ | Owner/repartidor |
| POST | /orders/{id}/accept | ✅ | Repartidor |
| POST | /orders/{id}/status | ✅ | Repartidor/admin |
| POST | /orders/{id}/cancel | ✅ | Owner si pendiente |
| GET | /orders/active | ✅ | Admin |
| GET | /orders/available | ✅ | Repartidor |
| GET | /orders/deliverer/{id} | ✅ | Propio |
| GET | /ratings/health | ❌ | Bloqueado por gateway |
| POST | /ratings/restaurant | ❌ | Bloqueado por gateway |
| GET | /api/profiles/me | ❌ | User-service returns 500 |

### Puerto 8003 (Rating Service directo)
| Método | Endpoint | Status |
|--------|----------|--------|
| GET | /health | ✅ |
| POST | /ratings/restaurant | ✅ |
| GET | /ratings/restaurant/{id} | ✅ |
| GET | /ratings/restaurant/user/{id} | ✅ |
| GET | /ratings/restaurant/restaurant/{id} | ✅ |
| GET | /ratings/stats/restaurant/{id} | ✅ |
| PATCH | /ratings/restaurant/{id} | ✅ |
| DELETE | /ratings/restaurant/{id} | ✅ |
| POST | /ratings/delivery | ⚠️ | Requiere pedido entregado |

---

## Scripts de Prueba

Archivos disponibles en `postman/curl/`:

1. **gateway-complete-tests.sh** - Prueba todos los endpoints через gateway
2. **restaurant-service.manual-tests.sh** - Original (para servicio directo)
3. **order-service.manual-tests.sh** - Original (para servicio directo)
4. **rating-service.manual-tests.sh** - Original (para servicio directo en 8003)
5. **user-service.manual-tests.sh** - Original (no funciona por bug)

---

## Bugs Identificados

1. **User Service (CRÍTICO)**
   - Error 500 en todos los endpoints
   - Falta configuración AddAuthentication()
   - Impacto: Registro de usuarios no funciona

2. **Rating Service via Gateway**
   - No accesible a través del gateway
   - Necesita agregar '/ratings' a rutas públicas en auth.middleware.ts

3. **JWT en Gateway**
   - Tokens generados localmente no son aceptados
   - Solo funciona con tokens del auth-service