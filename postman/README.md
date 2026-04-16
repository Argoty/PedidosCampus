# 📮 Postman Collection — User Service

Colección completa para testing del microservicio User Service (ASP.NET 8 + PostgreSQL + EF Core).

## 🚀 Quick Start

### 1. **Import Collection**
- En Postman: `File` → `Import`
- Selecciona `postman/user-service.postman_collection.json`
- Se importarán automáticamente:
  - 15 endpoints organizados en 4 carpetas
  - 5 variables de entorno (base_url, jwt_token, etc.)
  - Pre-request scripts para JWT y headers

### 2. **Configure Variables**
Collection → `Variables` tab:
- `base_url`: http://localhost:5000 (default, can change)
- `jwt_token`: Leave empty initially (será auto-generado)
- `test_user_id`: UUID de prueba (default: 550e8400-e29b-41d4-a716-446655440000)

### 3. **Generate Mock JWT**
⚠️ **Importante**: Los endpoints REQUIEREN JWT con claim `sub` (userId).

Dos opciones:

#### Opción A: Usar el script auto-generador (recomendado)
1. En Postman, ve a la carpeta **"1️⃣ Setup & Variables"**
2. Click en request **"Generate JWT Mock Token"**
3. Click **"Send"**
4. El JWT se auto-genera y guarda en `jwt_token` variable
5. Ahora todos los demás requests usarán este token automáticamente

#### Opción B: Token real de auth-service
Cuando auth-service esté operativo:
1. Llama a `POST /auth/login` en auth-service
2. Copia el JWT del response
3. En Postman, pega el token en `jwt_token` variable
4. Ahora todos los requests lo usarán

### 4. **Start Testing**
- Asegúrate que Docker Compose está corriendo: `docker compose up`
- Abre cualquier request y click **"Send"**
- Los pre-request scripts automáticamente agregarán el JWT

## 📂 Estructura de Carpetas

### 1️⃣ **Setup & Variables**
- Base URL Configuration: Valida conexión y configura variables
- Generate JWT Mock Token: Genera un JWT para testing

### 2️⃣ **User Endpoints (Public)**
Endpoints accesibles por usuarios autenticados (cualquier usuario se accede a su propio perfil):
- `GET /api/profiles/me` — Get own profile
- `POST /api/profiles` — Create new profile
- `PATCH /api/profiles/me` — Update own profile
- `GET /api/profiles/me/availability` — Get availability status
- `POST /api/profiles/me/availability` — Set availability

### 3️⃣ **Admin Endpoints**
Endpoints solo para admins (require `admin` role):
- `GET /api/profiles` — List all profiles (with filters)
- `GET /api/profiles/{profileId}` — Get profile by ID
- `PATCH /api/profiles/{profileId}` — Update any profile
- `POST /api/profiles/{profileId}/activate` — Activate profile
- `POST /api/profiles/{profileId}/deactivate` — Deactivate profile
- `DELETE /api/profiles/{profileId}` — Delete profile

### 4️⃣ **Internal Endpoints (via Gateway)**
⚠️ Solo para API Gateway y order-service. Require `x-client: gateway` header:
- `GET /api/profiles/delivery` — List available delivery persons
- `GET /api/profiles/search` — Advanced search
- `POST /api/profiles/{profileId}/reserve` — Atomic reserve (race condition safe)
- `POST /api/profiles/{profileId}/release` — Release reservation

### 5️⃣ **Integration Tests**
Workflows end-to-end (carpeta vacía, para agregar manualmente tests complejos):
- Complete User Lifecycle
- Delivery Person Availability
- Admin Management

### 📚 **Documentation**
Referencia de formatos:
- Error Response Format
- Response Models

## 🔐 JWT Token Details

El mock JWT contiene:
```
Header:  {"alg": "HS256", "typ": "JWT"}
Payload: {
  "sub": "<test_user_id>",
  "role": "usuario",
  "iat": <now>,
  "exp": <now + 3600>
}
Signature: "mock_signature_not_verified"
```

⚠️ **Nota**: El mock NO se verifica en el servidor (firmar/validar requiere clave secreta). El servicio acepta ANY JWT con claim `sub`. En producción, auth-service validará la firma.

## 📝 Testing Workflows

### Scenario 1: Create and Update User Profile
1. Run **"POST /profiles - Create Profile"**
2. Note the `profileId` from response
3. Update the `{profileId}` in next requests
4. Run **"PATCH /me - Update My Profile"**
5. Run **"GET /me - Get My Profile"** to verify

### Scenario 2: Manage Delivery Person
1. Update the request body to `"tipo": "repartidor"`
2. Run **"POST /profiles - Create Profile"**
3. Run **"POST /me/availability - Set Availability"** with `disponible: true`
4. Run **"GET /profiles/delivery"** (internal) to see available delivery persons

### Scenario 3: Admin Operations
1. Run **"GET /profiles - List All Profiles"** to see all profiles
2. Copy a `profileId`
3. Run **"GET /profiles/{profileId}"** with the copied ID
4. Run **"POST /profiles/{profileId}/deactivate"** to deactivate
5. Run **"POST /profiles/{profileId}/activate"** to reactivate

### Scenario 4: Atomic Reserve (Race Condition Safe)
1. Get an available delivery person's `profileId`
2. Run **"POST /profiles/{profileId}/reserve"** with `ttlSeconds: 300`
   - Success: 200 OK with `reservedUntil` timestamp
   - Conflict: 409 if already reserved
3. Run **"POST /profiles/{profileId}/release"** to release

## 🐛 Troubleshooting

### Error: "No JWT_TOKEN_SET"
- **Causa**: No generaste JWT
- **Solución**: Ve a "1️⃣ Setup & Variables" → "Generate JWT Mock Token" → Send

### Error: "401 Unauthorized"
- **Causa**: JWT inválido o expirado
- **Solución**: Regenera JWT con "Generate JWT Mock Token"

### Error: "403 Forbidden"
- **Causa**: Tu JWT no tiene el `role` necesario para ese endpoint
- **Solución**: 
  - Admin endpoints: Asegúrate que el JWT tiene `"role": "admin"`
  - Delivery endpoints: Asegúrate que el JWT tiene `"role": "repartidor"`
  - Para cambiar, regenera JWT manualmente (edita el script)

### Error: "404 Not Found"
- **Causa**: `profileId` no existe o service no está corriendo
- **Solución**:
  - Verifica: `docker compose ps` (user-service debe estar running)
  - Verifica: El profileId existe en BD

### Service Not Responding
- **Solución**:
  ```bash
  docker compose down
  docker compose up --build
  ```

## 🔗 Integration with Other Services

### When auth-service is ready:
1. Delete the "Generate JWT Mock Token" request
2. Add a new request: `POST auth-service:3001/auth/login`
3. Store the JWT from response in `jwt_token` variable

### When order-service needs to reserve delivery persons:
```bash
curl -X POST http://localhost:5000/api/profiles/{profileId}/reserve \
  -H "Authorization: Bearer $JWT" \
  -H "x-client: gateway" \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds": 300}'
```

## 📊 Response Examples

### Successful Profile Creation (201 Created)
```json
{
  "profileId": "550e8400-e29b-41d4-a716-446655440003",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "tipo": "usuario",
  "nombre": "Juan Pérez García",
  "telefono": "+34912345678",
  "direccion": "Calle Principal 123, 28001 Madrid",
  "disponible": false,
  "isActive": true,
  "reservedUntil": null,
  "createdAt": "2026-04-13T18:59:12Z",
  "updatedAt": "2026-04-13T18:59:12Z"
}
```

### Successful Reserve (200 OK)
```json
{
  "profileId": "550e8400-e29b-41d4-a716-446655440001",
  "disponible": true,
  "reservedUntil": "2026-04-13T19:04:12Z"
}
```

### Already Reserved (409 Conflict)
```json
{
  "code": "CONFLICT",
  "message": "Perfil ya reservado o no disponible",
  "details": {
    "reservedUntil": "2026-04-13T19:04:12Z"
  }
}
```

## 🎯 Next Steps

1. ✅ Import collection
2. ✅ Generate JWT token
3. ✅ Test individual endpoints
4. ✅ Run workflow scenarios
5. 📋 Document any issues found
6. 🔄 When auth-service ready: replace mock JWT with real tokens

---

**Created**: 2026-04-13  
**Service Version**: User Service v1 (ASP.NET 8)  
**Database**: PostgreSQL 16  
**Last Updated**: 2026-04-13
