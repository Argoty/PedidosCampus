# Auth Service API Documentation

## Overview

El **auth-service** es el microservicio responsable de la autenticación y autorización en la plataforma PedidosCampus. Maneja registro de usuarios, login, gestión de tokens (access + refresh), logout y perfil de usuario.

**Base URL:** `http://localhost:3001` (desarrollo local)

**Stack:** NestJS + Prisma + PostgreSQL + JWT

---

## Authentication & Security

### Service Token (x-service-token)

**TODAS** las requests no-OPTIONS deben incluir el header `x-service-token` con el token de servicio válido:

```
x-service-token: <SERVICE_TOKEN>
```

Sin este header, el servicio retorna `403 Forbidden`:

```json
{
  "statusCode": 403,
  "message": "Forbidden"
}
```

---

## Endpoints

### 1. POST /auth/register

Registra un nuevo usuario en el sistema.

**Autenticación:** No requerida (pública)

**Headers:**
| Header | Requerido | Descripción |
|--------|-----------|-------------|
| x-service-token | ✅ | Token de servicio |
| Content-Type | ✅ | `application/json` |

**Request Body:**

```json
{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "password": "123456",
  "telefono": "+5491123456789",
  "direccion": "Calle Falsa 123",
  "role": "usuario"  // opcional: "usuario" | "repartidor" (default: "usuario")
}
```

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| nombre | string | ✅ | Nombre completo (mínimo 2 caracteres) |
| email | string | ✅ | Email válido (formato email) |
| password | string | ✅ | Contraseña (mínimo 6 caracteres) |
| telefono | string | ❌ | Teléfono de contacto |
| direccion | string | ❌ | Dirección |
| role | string | ❌ | Rol del usuario: `"usuario"` o `"repartidor"`. Por defecto `"usuario"`. **Nunca** `"admin"` en registro público. |

**Response (201 Created):**

```json
{
  "user": {
    "id": "uuid-v4",
    "email": "juan@example.com",
    "nombre": "Juan Pérez",
    "telefono": "+5491123456789",
    "direccion": "Calle Falsa 123",
    "role": "usuario",
    "createdAt": "2026-05-04T10:30:00.000Z",
    "updatedAt": "2026-05-04T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies:**

| Cookie | Descripción |
|--------|-------------|
| refresh_token | HTTPOnly cookie con el refresh token (7 días de duración) |

**Errores:**

- `400 Bad Request` - Validación fallida (email inválido, password muy corto, etc.)
- `409 Conflict` - Email ya registrado

---

### 2. POST /auth/login

Autentica a un usuario existente.

**Autenticación:** No requerida (pública), usa `LocalAuthGuard` internamente

**Headers:**
| Header | Requerido | Descripción |
|--------|-----------|-------------|
| x-service-token | ✅ | Token de servicio |
| Content-Type | ✅ | `application/json` |

**Request Body:**

```json
{
  "email": "juan@example.com",
  "password": "123456"
}
```

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| email | string | ✅ | Email del usuario |
| password | string | ✅ | Contraseña (mínimo 6 caracteres) |

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid-v4",
    "email": "juan@example.com",
    "nombre": "Juan Pérez",
    "telefono": "+5491123456789",
    "direccion": "Calle Falsa 123",
    "role": "usuario",
    "createdAt": "2026-05-04T10:30:00.000Z",
    "updatedAt": "2026-05-04T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies:**

| Cookie | Descripción |
|--------|-------------|
| refresh_token | HTTPOnly cookie con el refresh token (7 días de duración) |

**Errores:**

- `401 Unauthorized` - Credenciales inválidas
- `400 Bad Request` - Validación fallida

---

### 3. POST /auth/refresh

Renueva los tokens de acceso usando el refresh token de la cookie.

**Autenticación:** Requiere cookie `refresh_token` válida (RefreshCookieGuard)

**Headers:**
| Header | Requerido | Descripción |
|--------|-----------|-------------|
| x-service-token | ✅ | Token de servicio |
| Cookie | ✅ | `refresh_token=<token>` |

**Request Body:** No requerido (los datos vienen de la cookie)

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid-v4",
    "email": "juan@example.com",
    "nombre": "Juan Pérez",
    "telefono": "+5491123456789",
    "direccion": "Calle Falsa 123",
    "role": "usuario",
    "createdAt": "2026-05-04T10:30:00.000Z",
    "updatedAt": "2026-05-04T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notas:**
- Realiza **token rotation**: invalida el refresh token anterior y emite uno nuevo
- La cookie se actualiza automáticamente con el nuevo refresh token

**Errores:**

- `401 Unauthorized` - Refresh token inválido, expirado o revocado

---

### 4. POST /auth/logout

Cierra la sesión actual del usuario.

**Autenticación:** Requiere cookie `refresh_token` válida (RefreshCookieGuard)

**Headers:**
| Header | Requerido | Descripción |
|--------|-----------|-------------|
| x-service-token | ✅ | Token de servicio |
| Cookie | ✅ | `refresh_token=<token>` |

**Request Body:** No requerido

**Response (200 OK):**

```json
{
  "message": "Sesion cerrada correctamente"
}
```

**Cookies:**

| Cookie | Acción |
|--------|--------|
| refresh_token | Se borra estableciendo maxAge=0 |

**Notas:**
- Revoca el refresh token en la base de datos
- Limpia la cookie del cliente

**Errores:**

- `401 Unauthorized` - Refresh token inválido

---

### 5. GET /auth/me

Obtiene el perfil del usuario autenticado.

**Autenticación:** Requiere JWT access token válido (JwtAuthGuard)

**Headers:**
| Header | Requerido | Descripción |
|--------|-----------|-------------|
| x-service-token | ✅ | Token de servicio |
| Authorization | ✅ | `Bearer <access_token>` |

**Request Body:** No requerido

**Response (200 OK):**

```json
{
  "id": "uuid-v4",
  "email": "juan@example.com",
  "nombre": "Juan Pérez",
  "telefono": "+5491123456789",
  "direccion": "Calle Falsa 123",
  "role": "usuario",
  "createdAt": "2026-05-04T10:30:00.000Z",
  "updatedAt": "2026-05-04T10:30:00.000Z"
}
```

**Notas:**
- El campo `passwordHash` **nunca** se expose en la respuesta
- El token tiene duración de 7 días

**Errores:**

- `401 Unauthorized` - Token inválido o expirado

---

### 6. GET /auth/admin/ping

Endpoint de verificación de acceso administrativo.

**Autenticación:** Requiere JWT access token con rol `admin`

**Headers:**
| Header | Requerido | Descripción |
|--------|-----------|-------------|
| x-service-token | ✅ | Token de servicio |
| Authorization | ✅ | `Bearer <access_token>` |

**Request Body:** No requerido

**Response (200 OK):**

```json
{
  "message": "Acceso admin concedido"
}
```

**Protección:**
- JwtAuthGuard: Valida JWT
- RolesGuard + @Roles(AuthRole.admin): Verifica rol de admin

**Errores:**

- `401 Unauthorized` - Token inválido o expirado
- `403 Forbidden` - Usuario autenticado pero sin rol admin

---

## Estructura de Respuestas

### AuthResponse

```typescript
interface AuthResponse {
  user: SafeAuthUser;
  accessToken: string;
}
```

### SafeAuthUser

```typescript
interface SafeAuthUser {
  id: string;
  email: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
  role: AuthRole;
  createdAt: Date;
  updatedAt: Date;
}
```

**Nota:** El campo `passwordHash` es исключён (Omit) de todas las respuestas.

---

## Tokens

### Access Token

- **Algoritmo:** JWT (HS256)
- **Duración:** 7 días
- **Payload:**

```json
{
  "sub": "uuid-del-usuario",
  "email": "juan@example.com",
  "role": "usuario",
  "type": "access",
  "jti": "uuid-unico-del-token",
  "iat": 1714818600,
  "exp": 1715423400
}
```

### Refresh Token

- **Tipo:** Token opaco (no es JWT, se almacena en BD)
- **Duración:** 7 días
- **Almacenamiento:** Base de datos (tabla `RefreshToken`)
- **Transporte:** Cookie HTTPOnly (seguro contra XSS)

---

## Cookies

### Refresh Token Cookie

| Propiedad | Valor |
|-----------|-------|
| Nombre | `refresh_token` |
| HttpOnly | ✅ true |
| Secure | ✅ true (producción) / false (desarrollo si COOKIE_SECURE=false) |
| SameSite | `strict` |
| Path | `/` |
| MaxAge | 7 días (604800000 ms) |

---

## Errores Comunes

| Código | Mensaje | Causa |
|--------|---------|-------|
| 400 | Validation failed | Body inválido según DTO |
| 401 | Unauthorized | Credenciales inválidas o token expirado |
| 403 | Forbidden | Falta x-service-token o rol insuficiente |
| 409 | Conflict | Email ya existe en registro |

---

## Configuración de Ambiente

Variables de entorno requeridas:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servicio (default: 3001) |
| `DATABASE_URL` | Connection string de PostgreSQL |
| `ACCESS_TOKEN_SECRET` | Clave secreta para firmar JWTs |
| `SERVICE_TOKEN` | Token para validación de x-service-token |
| `COOKIE_SECURE` | `true` para HTTPS, `false` para HTTP local |

---

## Ejemplos de Uso

### Registro con cURL

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -H "x-service-token: your-service-token" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "password": "123456",
    "role": "usuario"
  }'
```

### Login con cURL

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -H "x-service-token: your-service-token" \
  -d '{
    "email": "juan@example.com",
    "password": "123456"
  }'
```

### Obtener perfil (con access token)

```bash
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-service-token: your-service-token"
```

### Refresh token

```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "x-service-token: your-service-token" \
  -H "Cookie: refresh_token=your-refresh-token"
```

### Logout

```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "x-service-token: your-service-token" \
  -H "Cookie: refresh_token=your-refresh-token"
```

---

## Roles de Usuario

| Rol | Descripción |
|-----|-------------|
| `usuario` | Cliente que realiza pedidos (default) |
| `repartidor` | Repartidor que entrega pedidos |
| `admin` | Administrador del sistema (no disponible en registro público) |