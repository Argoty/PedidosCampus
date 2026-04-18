# AGENTS.md

## Scope and Current Reality
- This repo is a multi-service workspace; root `docker-compose.yml` is the executable source of truth for what runs together locally.
- Services wired in compose today: `auth-service`, `user-service`, `restaurant-service`, `order-service` plus their DBs.
- `notificaciones-service` is Cloudflare Workers + KV and runs outside compose via Wrangler.

## First Files to Read (high signal)
1. `docker-compose.yml`
2. `.env.docker.example`
3. `README.md`
4. Service-local `README.md` and manifest (`package.json`, `go.mod`, `*.csproj`, `wrangler.toml`)
5. Service-local `AGENTS.md` if present (there are focused ones in `microservices/order-service`, `microservices/user-service`, `microservices/restaurant-service`)

## Root Commands (verified)
- Start compose stack: `docker compose --env-file .env.docker up --build`
- Stop compose stack: `docker compose --env-file .env.docker down`
- If DB password/env changed and auth fails: `docker compose --env-file .env.docker down -v` then up again.
- Validate compose expansion: `docker compose --env-file .env.docker config`

## Environment and Secrets Gotchas
- Always pass `--env-file .env.docker` for compose commands; several services depend on it.
- Keep secrets out of tracked files. `wrangler.toml`, compose, and READMEs should contain placeholders only.
- Root `.gitignore` currently ignores generic `.env*`; do not rely on committing local env files.

## Service-Specific Quick Commands

### auth-service (`microservices/auth-service`)
- Install: `npm install`
- Prisma client: `npm run prisma:generate`
- Sync schema: `npm run prisma:push`
- Dev run: `npm run start:dev`
- Verify: `npm run build && npm test`
- Runtime note: production entrypoint is `dist/src/main.js`.

### notificaciones-service (`microservices/notificaciones-service`)
- Install: `npm install`
- Dev worker: `npm run dev` (wrangler dev)
- Verify: `npm run test` and `npm run typecheck`
- Requires KV namespace binding configured in `wrangler.toml` (`NOTIFICATIONS` id + preview_id).

### order-service (`microservices/order-service`)
- Use `microservices/order-service/AGENTS.md` as primary instructions.
- Core verify path: `go test ./... -v` and `go run ./cmd/api/main.go`.

### user-service (`microservices/user-service`)
- Use `microservices/user-service/AGENTS.md` as primary instructions.
- Core verify path: `dotnet restore && dotnet run` and `dotnet test`.

### restaurant-service (`microservices/restaurant-service`)
- Use `microservices/restaurant-service/AGENTS.md` as primary instructions.
- Core verify path: `pip install -r requirements.txt` then
  `DATABASE_URL='sqlite+aiosqlite:///:memory:' SECRET_KEY='test-secret' pytest tests -q`.

## Auth-Specific Security Notes (easy to miss)
- Refresh flow is cookie-only and opaque-token based (not refresh JWT).
- `POST /auth/refresh` and `POST /auth/logout` depend on cookie jar behavior in clients.
- Access token remains valid until expiry even after logout (expected unless access-token revocation is added).

## Notificaciones-Specific Architecture Note
- This service is currently TypeScript Workers + KV (not Python/FastAPI).
- Data model is emulated in KV with:
  - primary key `notif:{userId}:{createdAtMs}`
  - secondary index `notif_id:{id}` for mark-as-read by id.

## Testing and Collections
- Postman collections are centralized in `postman/`.
- Auth collection includes cookie-only refresh/logout flow; use one session with cookie jar enabled.

## Editing Hygiene
- Do not rewrite the whole repo docs when only one service changes.
- If instructions conflict, prefer executable config/scripts over prose.
