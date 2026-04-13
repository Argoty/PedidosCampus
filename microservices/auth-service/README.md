# Auth Service - PedidosCampus

Microservicio de autenticacion construido con NestJS + Prisma + PostgreSQL.

## Funcionalidades implementadas

- Registro de usuarios con `nombre`, `email`, `password` y `role` opcional.
- Login con `email` y `password`.
- Generacion de `accessToken` (15 min) y `refreshToken` (7 dias).
- Refresh token en cookie `HttpOnly` (`refresh_token`) y renovacion de sesion.
- Logout con invalidacion del refresh token almacenado.
- Soporte de roles: `usuario`, `repartidor`, `admin`.
- Endpoint protegido por rol admin para validar autorizacion.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/admin/ping` (solo admin)

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
