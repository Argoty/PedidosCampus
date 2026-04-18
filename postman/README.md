# 📮 Postman Collections — PedidosCampus

Colecciones para manual testing de microservicios.

## ✅ Import & Run — 3 Steps

### 1. Import Collections
```
File → Import → postman/user-service.postman_collection.json
File → Import → postman/order-service.postman_collection.json
File → Import → postman/restaurant-service.postman_collection.json
```
✅ Automáticamente para cada colección:
- 12+ endpoints con JWT pre-injection por rol
- Variables (BASE_URL, ADMIN_TOKEN, PUBLIC_TOKEN, etc.)
- Headers Authorization configurados por endpoint

### 2. Set Variables & Test
Cada colección tiene variables de colección preconfiguradas:
- **BASE_URL**: Puerto del servicio (ej: http://localhost:8001 para restaurant)
- **ADMIN_TOKEN**: JWT con rol admin
- **PUBLIC_TOKEN**: JWT con rol usuario/public

**Listo. Abre cualquier request y Send.**

## 📂 Endpoint Overview

| Service | Collection | Endpoints | Base URL | Auth |
|---------|-----------|-----------|----------|------|
| **User Service** | `user-service.postman_collection.json` | GET/POST/PATCH/DELETE `/api/profiles*` | `http://localhost:5000` | ✅ JWT (usuario/repartidor/admin) |
| **Order Service** | `order-service.postman_collection.json` | GET/POST `/orders*` | `http://localhost:8002` | ✅ JWT (usuario/admin) |
| **Restaurant Service** | `restaurant-service.postman_collection.json` | GET/POST/PATCH/DELETE `/api/v1/restaurants*` | `http://localhost:8001` | ✅ JWT (public/admin) |

### Restaurant Service Collection (`postman/restaurant-service.postman_collection.json`)

**Folders:**
- **Restaurantes - Public Operations** (GET list, GET detail) — Anyone with JWT
- **Restaurantes - Admin Operations** (POST create, PATCH update, POST activate/deactivate) — Admin only
- **Productos - Public Operations** (GET list, GET detail) — Anyone with JWT
- **Productos - Admin Operations** (POST create, PATCH update, DELETE soft-delete) — Admin only
- **Productos - Batch Operations** (POST validate-batch) — Order Service integration
- **Error Cases - Testing** (401/403/404 scenarios)

**Variables:**
- `BASE_URL`: `http://localhost:8001`
- `ADMIN_TOKEN`: JWT with admin role
- `PUBLIC_TOKEN`: JWT with public/usuario role
- `restaurante_id`: Placeholder for testing (set after creating a restaurant)
- `producto_id`: Placeholder for testing (set after creating a product)

## 🔐 JWT Details

3 pre-signed HS256 tokens inclusos, vigentes ~180 días:

| Token | Role | UUID | Use Case |
|-------|------|------|----------|
| **ADMIN_TOKEN** | admin | 550e8400-e29b-41d4-a716-446655440002 | Create/update/delete restaurants & products |
| **PUBLIC_TOKEN** | usuario | 550e8400-e29b-41d4-a716-446655440000 | List/view restaurants & products |
| **REPARTIDOR_TOKEN** | repartidor | 550e8400-e29b-41d4-a716-446655440001 | (User Service) Set availability, reserve |

**Secret (dev):** `ACCESS_TOKEN_SECRET=dev_access_token_secret_123_very_secret` (auth-service)

⚠️ Si cambiás el secreto en runtime, estos tokens dejan de funcionar. Regeneralos.

## 🎯 Test Workflows

### ✅ Workflow 1: Create Restaurant & Add Products (Admin)
```
1. Set BASE_URL = http://localhost:8001
2. POST /restaurants (create with ADMIN_TOKEN)
   → Copy restaurante_id from response
3. POST /restaurants/{id}/products (create product with ADMIN_TOKEN)
   → Copy producto_id from response
4. GET /restaurants/{id} (view with PUBLIC_TOKEN)
   → See restaurant with menu
```

### ✅ Workflow 2: Browse Restaurants (Public)
```
1. GET /restaurants (list all active with PUBLIC_TOKEN)
2. GET /restaurants/{id} (detail with PUBLIC_TOKEN)
3. GET /restaurants/{id}/products (menu with PUBLIC_TOKEN)
```

### ✅ Workflow 3: Batch Validation (Order Integration)
```
1. Create multiple products in a restaurant
2. POST /products/validate-batch (with PUBLIC_TOKEN)
   → Validate items are available & pricing correct
```

### ✅ Workflow 4: Activate/Deactivate (Admin)
```
1. POST /restaurants/{id}/activate (ADMIN_TOKEN)
2. POST /restaurants/{id}/deactivate (ADMIN_TOKEN)
3. Verify in GET /restaurants (is_active changes)
```

## 🐛 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| **401 Unauthorized** | JWT missing/invalid/expired | Run "Load JWT Tokens" setup request |
| **403 Forbidden** | Wrong role for endpoint | Change `active_role` and re-run setup |
| **404 Not Found** | Profile doesn't exist | Verify profileId or create one first |
| **409 Conflict** | Already reserved/exists | Release or use different profile |
| **Service not running** | Docker container down | `docker compose up --build` |

**Service health check:**
```bash
curl http://localhost:5000/swagger/v1/swagger.json
```

## ✅ Status — READY

- ✅ **User Service**: 15+ endpoints, JWT (usuario/repartidor/admin), soft delete + deactivate
- ✅ **Order Service**: 10+ endpoints, JWT (usuario/admin)
- ✅ **Restaurant Service**: 12 endpoints, JWT (public/admin), soft delete only
- ✅ All collections: Pre-configured variables, correct tokens, role-based headers
- ✅ Docker integration: Each service on different port (`5000`, `8001`, `8002`, etc.)

**Verification:**
```bash
# Terminal 1: Start compose
docker compose --env-file .env.docker up --build

# Terminal 2: Verify services
curl -s http://localhost:5000/swagger/v1/swagger.json | jq .info.title
curl -s http://localhost:8001/docs | grep -q "FastAPI" && echo "Restaurant running"
curl -s http://localhost:8002/api/health | jq .status
```
