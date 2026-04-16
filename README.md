# PedidosCampus

Plataforma universitaria de pedidos construida con arquitectura de microservicios asincronos.

## Estado actual del repositorio

Este repositorio esta en fase de primera entrega academica. Por ahora incluye:

- Documentacion funcional y diagramas en `docs/`
- Esquemas Prisma por microservicio en la raiz (`*-schema.prisma`)
- Microservicios implementados:
  - `Auth` en `microservices/auth-service`
  - `Notificaciones` en `microservices/notificaciones-service`

## Microservicios disponibles hoy

### Auth (`microservices/auth-service`)

Incluye:

- Registro, login, refresh, logout y perfil
- Roles `usuario`, `repartidor`, `admin`
- JWT access token (15 min) + refresh token (7 dias)
- Prisma + PostgreSQL
- Dockerfile y pruebas unitarias basicas

### Notificaciones (`microservices/notificaciones-service`)

Incluye:

- Runtime nativo de Cloudflare Workers (TypeScript)
- Almacenamiento NoSQL en Cloudflare KV
- Endpoints: crear, listar por usuario, marcar como leida y health
- Estructura serverless minimalista sin frameworks HTTP
- Configuracion lista para `wrangler dev` y `wrangler deploy`

## Levantar en local con Docker

Desde la raiz del repo:

1. Copiar variables locales de docker:
   - `cp .env.docker.example .env.docker`
2. Levantar servicios:
   - `docker compose --env-file .env.docker up --build`

Servicios expuestos:

- Auth API: `http://localhost:3001`
- PostgreSQL de Auth: `localhost:5433`

## Levantar Notificaciones en local (Cloudflare Workers)

Desde `microservices/notificaciones-service`:

1. Instalar dependencias:
   - `npm install`
2. Crear namespace KV:
   - `npx wrangler kv namespace create NOTIFICATIONS`
3. Copiar el `id` y `preview_id` en `wrangler.toml`
4. Ejecutar en local:
   - `npm run dev`

Endpoint local por defecto:

- Notificaciones Worker: `http://127.0.0.1:8787`

## Pruebas de endpoints

Importa en Postman:

- `postman/auth-service.postman_collection.json`
- `postman/notificaciones-service.postman_collection.json`

## Nota sobre AGENTS.md

`AGENTS.md` es una guia operativa para asistentes/agentes de desarrollo dentro de este repo. Este `README.md` es la guia general para personas del equipo.
