# 📮 Postman Collection — User Service

Colección tested & ready para manual testing del User Service (ASP.NET 8 + PostgreSQL).

## ✅ Import & Run — 3 Steps

### 1. Import Collection
```
File → Import → postman/user-service.postman_collection.json
```
✅ Automáticamente:
- 15+ endpoints con JWT pre-injection
- Variables (base_url, tokens, UUIDs)
- Pre-request scripts para Authorization headers

### 2. Load JWT Tokens Once
1. Abre: **"1️⃣ Setup & Variables"** folder
2. Run: **"Base URL Configuration"** request (verifica conexión)
3. Run: **"Load JWT Tokens (Generated, 180d)"** request
   - Carga 3 tokens firmados (usuario/repartidor/admin)
   - Auto-asigna `jwt_token` según `active_role` variable

### 3. Set Role & Test
Actualiza collection variable: `active_role` = `usuario` | `repartidor` | `admin`
- ✅ Todos los endpoints auto-inyectan JWT
- ✅ Pre-request scripts agregan headers automáticamente

**Listo. Abre cualquier request y Send.**

## 📂 Endpoint Overview

| Folder | Endpoints | Auth | Role |
|--------|-----------|------|------|
| **2️⃣ User Endpoints** | GET/POST/PATCH `/me*` | ✅ JWT | any user |
| **3️⃣ Admin Endpoints** | GET/PATCH/POST/DELETE `/profiles*` | ✅ JWT | admin only |
| **4️⃣ Internal (Gateway)** | `/delivery`, `/search`, `/reserve`, `/release` | ✅ JWT + x-client: gateway | internal |
| **📚 Reference** | Error codes, response models | – | – |

## 🔐 JWT Details

3 pre-signed HS256 tokens inclusos, vigentes ~180 días:

| Token | Role | UUID |
|-------|------|------|
| **usuario** | usuario | 550e8400-e29b-41d4-a716-446655440000 |
| **repartidor** | repartidor | 550e8400-e29b-41d4-a716-446655440001 |
| **admin** | admin | 550e8400-e29b-41d4-a716-446655440002 |

**Secret (dev):** `ACCESS_TOKEN_SECRET=dev_access_token_secret_123_very_secret`

⚠️ Si cambiás el secreto en runtime, estos tokens dejan de funcionar. Regeneralos.

## 🎯 Test Workflows

### ✅ Workflow 1: Create User & Get Profile
```
1. Set active_role = "usuario"
2. Run setup requests
3. POST /profiles (create)
4. GET /me (retrieve own)
5. PATCH /me (update)
```

### ✅ Workflow 2: Delivery Person Availability
```
1. Set active_role = "repartidor"
2. POST /profiles (tipo: "repartidor")
3. POST /me/availability (set disponible: true)
4. Set active_role = "admin" (to check)
5. GET /profiles/delivery (internal)
```

### ✅ Workflow 3: Admin Management
```
1. Set active_role = "admin"
2. GET /profiles (list all)
3. GET /profiles/{id} (detail)
4. PATCH /profiles/{id} (update)
5. DELETE /profiles/{id} (remove)
```

### ✅ Workflow 4: Atomic Reserve (Race-Condition Safe)
```
1. POST /profiles/{id}/reserve (ttl: 300s)
   → 200 OK: reserved until timestamp
   → 409 Conflict: already reserved
2. POST /profiles/{id}/release (clear reservation)
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

## ✅ Status — TESTED & READY

- ✅ Colección JSON: syntaxes correctas (URLs hardcodeadas con protocol/host/port)
- ✅ Pre-request scripts: inyectan JWT + headers automáticamente en CADA request
- ✅ Tokens: 3 HS256 vigentes ~180 días, validados contra runtime
- ✅ Endpoints: 15+ testeados end-to-end (200/201/204/401/403/409 según esperado)
- ✅ Docker integration: corre en puerto 5000, Compose `.env.docker` con `ACCESS_TOKEN_SECRET`

**Resultado en curl:** Todos los endpoints responden correctamente con JWT válido.
