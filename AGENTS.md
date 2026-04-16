# AGENTS.md

## Estado real del repo
- Hay 2 microservicios ejecutables: `microservices/auth-service` (NestJS + Prisma + PostgreSQL) y `microservices/notificaciones-service` (Cloudflare Workers + KV).
- `docker-compose.yml` solo orquesta Auth (`auth-db` y `auth-service`); Notificaciones no corre por Docker en este repo.
- No hay workflows CI en `.github/workflows`.

## Fuentes de verdad (orden)
1. Configuracion ejecutable: `docker-compose.yml`, `microservices/auth-service/package.json`, `microservices/notificaciones-service/package.json`, `microservices/notificaciones-service/wrangler.toml`.
2. READMEs por servicio: `microservices/auth-service/README.md`, `microservices/notificaciones-service/README.md`.
3. Documentacion academica: `docs/RequisitosFuncionales.md`, `docs/diagramaMicroservicios.mmd`.

Si docs y scripts/config difieren, confiar en scripts/config.

## Comandos verificados
- Auth con Docker (desde raiz):
  - `cp .env.docker.example .env.docker`
  - `docker compose --env-file .env.docker up --build`
  - `docker compose --env-file .env.docker down`
  - `docker compose --env-file .env.docker logs -f auth-service auth-db`
- Auth sin Docker (desde `microservices/auth-service`):
  - `npm install && npm run prisma:generate && npm run prisma:push && npm run start:dev`
  - Validacion minima: `npm run build && npm test`
- Notificaciones local (desde `microservices/notificaciones-service`):
  - `npm install`
  - `npx wrangler login`
  - `npx wrangler kv namespace create NOTIFICATIONS`
  - opcional preview remoto: `npx wrangler kv namespace create NOTIFICATIONS --preview`
  - actualizar IDs en `wrangler.toml`
  - `npm run dev`
  - Validacion minima: `npm run typecheck && npm test`
- Notificaciones deploy (desde `microservices/notificaciones-service`):
  - `npm run deploy`

## Gotchas que evitan errores
- En Docker Compose de Auth, siempre pasar `--env-file .env.docker`; si no, variables sensibles pueden quedar vacias.
- Si cambias `AUTH_DB_PASSWORD` tras inicializar volumen, Postgres fallara autenticacion; reset de desarrollo: `docker compose --env-file .env.docker down -v`.
- Build de Auth arranca en `dist/src/main.js` (no `dist/main.js`).
- PostgreSQL Docker usa host `5433` para evitar conflicto con `5432` local.
- En Notificaciones, cada notificacion guarda 2 claves KV por diseno (`notif:*` + `notif_id:*`); no es duplicado accidental.
- `wrangler.toml` incluye `id` y `preview_id` del namespace KV; esos IDs no son secretos.
- `wrangler dev` usa KV local por defecto; para usar KV remoto en desarrollo: `npx wrangler dev --remote`.

## Limites de alcance academico
- Primera entrega: servicios sin integracion activa entre si.
- No asumir Gateway operativo ni RabbitMQ conectado hasta que haya artefactos ejecutables en el repo.

## Ubicaciones faciles de confundir
- El diagrama vigente esta en `docs/diagramaMicroservicios.mmd` (nombre en minuscula).
- Colecciones Postman: `postman/auth-service.postman_collection.json` y `postman/notificaciones-service.postman_collection.json`.
