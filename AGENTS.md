# AGENTS.md

## Estado real del repo (verificado en código/config)
- Stack ejecutable con Docker Compose en raíz: `auth-service` (NestJS) + `user-service` (ASP.NET 8) y sus BDs (`auth-db`, `user-db`).
- `order-service` y `restaurant-service` están en estado placeholder (solo README corto).
- No hay workflows en `.github/workflows/` ni `opencode.json` en el repo.

## Fuentes de verdad (en este orden)
1. `docker-compose.yml` (qué corre realmente en local).
2. `microservices/auth-service/package.json` + `Dockerfile` + `prisma/auth-schema.prisma`.
3. `microservices/user-service/Program.cs` + `UserService.csproj` + `Dockerfile`.
4. READMEs solo para contexto; si difieren de scripts/config, gana lo ejecutable.

## Comandos verificados (no adivinar)
- Levantar todo: `docker compose --env-file .env.docker up --build`
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

## Gotchas que hacen perder tiempo
- Para Compose, usar SIEMPRE `--env-file .env.docker`: `AUTH_DB_PASSWORD`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` no tienen fallback seguro.
- Si cambiás `AUTH_DB_PASSWORD` o `USER_DB_PASSWORD` con volúmenes ya creados, puede fallar autenticación de Postgres. Reset dev: `docker compose --env-file .env.docker down -v`.
- Puertos host reales:
  - Auth API `3001`, Auth DB `5433`
  - User API `5000`, User DB `5434`
- `auth-service` en Docker ejecuta `prisma db push` al arrancar (en `CMD`), no usa migraciones versionadas.

## Límites de alcance (académico)
- No asumir gateway, RabbitMQ ni integración entre microservicios como “hecho” mientras no haya artefactos ejecutables que lo respalden.

## Puntos de entrada y límites por servicio
- Auth: `src/main.ts` → `AppModule` → `AuthModule` (`/auth/*`).
- User: `Program.cs` + `src/Controllers/ProfilesController.cs` (`/api/profiles/*`).
- Tests de user-service usan EF InMemory (`Tests/ProfileServiceTests.cs`), no PostgreSQL real.
