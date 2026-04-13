# AGENTS.md

## Estado verificado del repo (hoy)
- Ya no es solo documental: existe un microservicio ejecutable en `microservices/auth-service` (NestJS + Prisma + Jest + Dockerfile).
- Orquestacion local en raiz con `docker-compose.yml` (servicios `auth-db` y `auth-service`).
- Colecciones Postman centralizadas en `postman/` (actualmente `postman/auth-service.postman_collection.json`).

## Fuentes de verdad (orden recomendado)
1. Configuracion ejecutable: `docker-compose.yml`, `microservices/auth-service/package.json`, `microservices/auth-service/Dockerfile`.
2. `README.md` (raiz) y `microservices/auth-service/README.md` para flujo operativo.
3. `docs/RequisitosFuncionales.md` para alcance funcional academico.

Si hay conflicto entre docs y scripts/config reales, priorizar scripts/config reales.

## Comandos que si estan verificados
- Levantar stack local (recomendado): `docker compose --env-file .env.docker up --build`
- Bajar stack: `docker compose --env-file .env.docker down`
- Ver logs: `docker compose --env-file .env.docker logs -f auth-service auth-db`
- Auth local sin Docker (desde `microservices/auth-service`):
  - `npm install`
  - `npm run prisma:generate`
  - `npm run prisma:push`
  - `npm run start:dev`
- Verificacion minima del micro Auth (desde `microservices/auth-service`):
  - `npm run build`
  - `npm test`

## Gotchas importantes (evitan errores comunes)
- `docker-compose.yml` usa variables sensibles de `.env.docker` (`AUTH_DB_PASSWORD`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`). Si no pasas `--env-file .env.docker`, Compose puede arrancar con valores vacios.
- Si cambias `AUTH_DB_PASSWORD` despues de haber inicializado Postgres, el volumen persistente conserva la clave anterior y falla con `P1000`/`password authentication failed`.
  - Solucion de desarrollo: `docker compose --env-file .env.docker down -v` y volver a levantar.
- En este proyecto el build Nest genera entrada en `dist/src/main.js` (no `dist/main.js`).
- Puerto host de Postgres Docker es `5433` para evitar conflicto con Postgres local en `5432`.

## Alcance academico a respetar
- Primera entrega: microservicios sin integracion activa entre ellos.
- No asumir Gateway operativo ni RabbitMQ conectado mientras no existan artefactos ejecutables que lo demuestren.
