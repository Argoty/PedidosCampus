# Auth Service API Documentation

## Overview
Auth Service gestiona autenticación, autorización y sesiones de usuario. Usa JWT para acceso y refresh tokens (HttpOnly cookies) para rotación.

**Base URL:** `http://localhost:3000/auth` (via Gateway)

---

## Endpoints

### 1. POST /auth/register
Registra nuevo usuario. Crea cuenta en Auth Service y perfil en User Service.

**Request:**
```json
{
  "nombre": "string (min: 2 chars)",
  "email": "string (valid email)",
  "password": "string (min: 6 chars)",
  "telefono": "string (optional)",
  "direccion": "string (optional)",
  "role": "usuario | repartidor (optional, default: usuario)"
}
```

**Valid Roles:**
- `usuario` - Usuario regular (default)
- `repartidor` - Repartidor/delivery

**Note:** `admin` role **never** allowed via registration. Requires DB migration or future admin API.

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "nombre": "Leonardo",
    "email": "leo@campus.edu",
    "role": "usuario | repartidor",
    "isActive": true,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Side Effects:**
- Sets HttpOnly cookie: `refresh_token`
- Creates user profile in User Service (Tipo: usuario/repartidor)

**Error Responses:**
- `400`: Email already registered / User Service sync failed
- `400`: Invalid body (validation failed)

---

### 2. POST /auth/login
Autentica usuario existente con email + password.

**Request:**
```json
{
  "email": "string (valid email)",
  "password": "string"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "nombre": "Leonardo",
    "email": "leo@campus.edu",
    "role": "usuario",
    "isActive": true,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Side Effects:**
- Sets HttpOnly cookie: `refresh_token`

**Error Responses:**
- `401`: Invalid credentials
- `401`: User inactive

---

### 3. POST /auth/refresh
Rota refresh token y emite nuevo access token.

**Requirements:**
- Must have valid `refresh_token` cookie (HttpOnly)

**Request:**
No body needed (reads from HttpOnly cookie)

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "nombre": "Leonardo",
    "email": "leo@campus.edu",
    "role": "usuario",
    "isActive": true,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Side Effects:**
- Invalidates old refresh token (reuse detection)
- Sets new HttpOnly cookie: `refresh_token`

**Error Responses:**
- `401`: No/invalid refresh token in cookie
- `401`: Refresh token expired
- `401`: Refresh token already used (session compromised - all sessions revoked)
- `401`: User inactive

---

### 4. POST /auth/logout
Revoca refresh token y cierra sesión.

**Requirements:**
- Must have valid `refresh_token` cookie (HttpOnly)

**Request:**
No body needed

**Response (200):**
```json
{
  "message": "Sesion cerrada correctamente"
}
```

**Side Effects:**
- Revokes refresh token from DB
- Clears HttpOnly cookie: `refresh_token`

**Error Responses:**
- `401`: No/invalid refresh token in cookie

---

### 5. GET /auth/me
Obtiene perfil del usuario autenticado.

**Requirements:**
- `Authorization: Bearer <accessToken>` (header)

**Response (200):**
```json
{
  "id": "uuid",
  "nombre": "Leonardo",
  "email": "leo@campus.edu",
  "role": "usuario",
  "isActive": true,
  "createdAt": "2026-04-10T00:00:00.000Z",
  "updatedAt": "2026-04-10T00:00:00.000Z"
}
```

**Error Responses:**
- `401`: Missing/invalid JWT
- `404`: User not found or inactive

---

### 6. GET /auth/admin/ping
Verifica acceso admin (solo para role: admin).

**Requirements:**
- `Authorization: Bearer <accessToken>` (header)
- User role must be `admin`

**Response (200):**
```json
{
  "message": "Acceso admin concedido"
}
```

**Error Responses:**
- `401`: Missing/invalid JWT
- `403`: User not admin

---

## Token Details

### Access Token
- **Type:** JWT
- **Format:** `header.payload.signature`
- **Payload:**
  ```json
  {
    "sub": "uuid (userId)",
    "email": "string",
    "role": "usuario | repartidor | admin",
    "type": "access",
    "jti": "uuid (JWT ID for tracking)",
    "iat": 1234567890,
    "exp": 1234567890
  }
  ```
- **Expiration:** Configurable (default: 1 hour)
- **Storage:** Client passes in `Authorization: Bearer <token>` header
- **Verification:** Gateway + microservices validate using `ACCESS_TOKEN_SECRET` env var

### Refresh Token
- **Type:** Opaque random bytes (64 bytes base64url)
- **Storage:** HttpOnly cookie (not readable by JS)
- **Expiration:** Configurable (default: 7 days)
- **Security:**
  - Never sent in response body
  - Reuse detection: if revoked token used again, all user sessions revoked
  - DB stores SHA256 hash only (never plain text)

---

## Cookie Details

### refresh_token Cookie
```
Name: refresh_token
Value: <opaque token>
HttpOnly: true
Secure: true (production), false (local dev)
SameSite: strict
Path: /
MaxAge: 7 days (604800000 ms)
```

---

## Security Notes

1. **Password:** Never sent back in responses (passwordHash never exposed)
2. **Admin Role:** Cannot be set via registration; requires DB migration
3. **Refresh Rotation:** Each refresh invalidates previous token
4. **Reuse Detection:** If revoked token used again, ALL user sessions are terminated
5. **Cookie Security:** HttpOnly + Secure + SameSite strict
6. **User Sync:** On registration, User Service profile created atomically (rollback on failure)

---

## Error Codes Reference

| Code | Scenario |
|------|----------|
| `400` | Invalid request body / validation failed |
| `401` | Missing/invalid JWT, inactive user, expired token |
| `403` | Missing required role (e.g., admin endpoint with user role) |
| `404` | User not found |
| `500` | Server error (e.g., User Service sync failed) |

---

## Example Flow

1. **Register:** POST `/auth/register` → Get `accessToken` + `refresh_token` cookie
2. **Make Request:** GET `/auth/me` with `Authorization: Bearer <accessToken>`
3. **Token Expires:** Use `/auth/refresh` (reads cookie automatically) → Get new `accessToken`
4. **Logout:** POST `/auth/logout` → Cookie cleared, token revoked
