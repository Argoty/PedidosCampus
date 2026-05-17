# Auth Service - PedidosCampus

Microservicio de autenticacion construido con NestJS + Prisma + PostgreSQL.

## Funcionalidades implementadas

- Registro de usuarios con `nombre`, `email`, `password` y `role` opcional.
- Login con `email` y `password`.
- Access token JWT (15 min).
- Refresh token opaco (7 dias) solo por cookie HttpOnly.
- Rotacion de refresh token en cada `POST /auth/refresh`.
- Deteccion de reuse de refresh token revocado (revoca sesiones activas del usuario).
- Logout con invalidacion de refresh token y limpieza de cookie.
- Soporte de roles: `usuario`, `repartidor`, `admin`.
- Endpoint protegido por rol admin para validar autorizacion.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/admin/ping` (solo admin)

## Seguridad de refresh tokens

- El refresh token es opaco (aleatorio), no JWT.
- Solo se almacena hash SHA-256 del refresh token en base de datos.
- El backend envia/lee refresh token solo por cookie HttpOnly.
- `POST /auth/refresh` usa cookie solamente (sin body/header para refresh).
- `POST /auth/logout` usa cookie y limpia `refresh_token` con `Max-Age=0`.

Esto reduce riesgos de robo por XSS y evita exponer refresh tokens en logs/body del frontend.

## Cookies y CORS

- `HttpOnly: true`
- `SameSite: strict`
- `Path: /`
- `Secure: true` en produccion
- `Secure: false` solo en local HTTP (`COOKIE_SECURE=false`)

CORS esta configurado con `credentials: true` para permitir cookies entre frontend y backend.

## Ejecutar en local (sin Docker)

1. Copiar variables:
   - `cp .env.example .env`
2. Instalar dependencias:
   - `npm install`
3. Generar cliente Prisma:
   - `npm run prisma:generate`
4. Aplicar esquema en BD:
   - `npm run prisma:push`
5. Levantar servicio:
   - `npm run start:dev`

## Pruebas

- `npm test`

## Docker

Desde la raiz del repo:

1. Crear archivo de variables para docker compose:
   - `cp .env.docker.example .env.docker`
2. Levantar contenedores:
   - `docker compose --env-file .env.docker up --build`

Esto levantara `auth-db` (PostgreSQL) y `auth-service`.

Puertos:

- Auth service: `http://localhost:3001`
- PostgreSQL docker: `localhost:5433` (mapeado al `5432` interno del contenedor)

Nota: se usa `5433` en host para evitar conflicto cuando ya tienes PostgreSQL local en `5432`.

## Postman

- Coleccion Auth: `postman/auth-service.postman_collection.json`

La coleccion ya esta preparada para flujo cookie-only en refresh/logout.
