# AGENTS.md

## Estado real del repo (verificado en código/config)
- Stack ejecutable con Docker Compose en raíz: 3 microservicios
  - `auth-service` (NestJS + Prisma + PostgreSQL)
  - `user-service` (ASP.NET 8 + EF Core + PostgreSQL)
  - `notificaciones-service` (Cloudflare Workers + KV)
- `order-service` y `restaurant-service` están en estado placeholder (solo README corto).
- `docker-compose.yml` orquesta: `auth-service`, `auth-db`, `user-service`, `user-db`
- Notificaciones no corre en Docker en este repo (Cloudflare Workers)
- No hay workflows en `.github/workflows/` ni `opencode.json` en el repo.

## Fuentes de verdad (en este orden)
1. `docker-compose.yml` (qué corre realmente en local).
2. `microservices/auth-service/package.json` + `Dockerfile` + `prisma/auth-schema.prisma`.
3. `microservices/user-service/Program.cs` + `UserService.csproj` + `Dockerfile`.
4. `microservices/notificaciones-service/wrangler.toml` + `package.json`.
5. READMEs solo para contexto; si difieren de scripts/config, gana lo ejecutable.

## Comandos verificados (no adivinar)
- Levantar stack Docker (auth + user): `docker compose --env-file .env.docker up --build`
- Bajar todo: `docker compose --env-file .env.docker down`
- Logs: `docker compose --env-file .env.docker logs -f auth-service user-service auth-db user-db`

### Auth service (desde `microservices/auth-service`)
- Setup local: `npm install && npm run prisma:generate && npm run prisma:push && npm run start:dev`
- Tests: `npm test`
- Build output real para prod: `dist/src/main.js` (script `start:prod`).

### User service (desde `microservices/user-service`)
- Setup local: `dotnet restore && dotnet run` (o `dotnet watch run`)
- Tests: `dotnet test`
- Migraciones: en `Development`, `Program.cs` ejecuta `dbContext.Database.Migrate()` al iniciar.

### Notificaciones service (desde `microservices/notificaciones-service`)
- Setup local: `npm install && npx wrangler login && npx wrangler kv namespace create NOTIFICATIONS`
- Copiar `id` y `preview_id` en `wrangler.toml`
- Dev mode: `npm run dev` (local en http://127.0.0.1:8787)
- Tests: `npm test`
- Deploy: `npm run deploy`

## Gotchas que hacen perder tiempo
- Para Compose, usar SIEMPRE `--env-file .env.docker`: `AUTH_DB_PASSWORD`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` no tienen fallback seguro.
- Si cambiás `AUTH_DB_PASSWORD` o `USER_DB_PASSWORD` con volúmenes ya creados, puede fallar autenticación de Postgres. Reset dev: `docker compose --env-file .env.docker down -v`.
- Puertos host reales:
  - Auth API `3001`, Auth DB `5433`
  - User API `5000`, User DB `5434`
  - Notificaciones Worker (local) `8787`
- `auth-service` en Docker ejecuta `prisma db push` al arrancar (en `CMD`), no usa migraciones versionadas.
- En Notificaciones, cada notificacion guarda 2 claves KV por diseño (`notif:*` + `notif_id:*`); no es duplicado accidental.
- `wrangler.toml` incluye `id` y `preview_id` del namespace KV; esos IDs no son secretos.
- `wrangler dev` usa KV local por defecto; para usar KV remoto en desarrollo: `npx wrangler dev --remote`.

## Límites de alcance (académico)
- Primera entrega: servicios sin integración activa entre ellos.
- No asumir gateway, RabbitMQ ni integración entre microservicios como "hecho" mientras no haya artefactos ejecutables que lo respalden.

## Puntos de entrada y límites por servicio
- Auth: `src/main.ts` → `AppModule` → `AuthModule` (`/auth/*`).
- User: `src/Program.cs` + `src/Controllers/ProfilesController.cs` (`/api/profiles/*`).
- Notificaciones: `src/index.ts` (Workers entry) + handlers en `src/handlers/` + KV service en `src/services/kv.ts`.
- Tests de user-service usan EF InMemory (`Tests/ProfileServiceTests.cs`), no PostgreSQL real.

## Ubicaciones fáciles de confundir
- El diagrama vigente está en `docs/diagramaMicroservicios.mmd` (nombre en minúscula).
- Colecciones Postman: `postman/auth-service.postman_collection.json` y `postman/notificaciones-service.postman_collection.json`.
