# AGENTS.md

## Fast Reality Check
- Source of truth for local runtime is root `docker-compose.yml`, not README prose.
- Compose runs `gateway-service`, `auth-service`, `user-service`, `restaurant-service`, `order-service` + Postgres DBs.
- Only `gateway-service` is exposed publicly (`3000:3000`); internal services are reached through Docker network.
- `notificaciones-service` runs outside compose as Cloudflare Worker (`microservices/notificaciones-service`).

## Read First
1. `docker-compose.yml`
2. `.env.docker.example`
3. Service-local `AGENTS.md`:
   - `microservices/order-service/AGENTS.md`
   - `microservices/user-service/AGENTS.md`
   - `microservices/restaurant-service/AGENTS.md`
4. Service manifests (`package.json`, `go.mod`, `*.csproj`, `wrangler.toml`)

## Verified Root Commands
- Start stack: `docker compose --env-file .env.docker up --build`
- Stop stack: `docker compose --env-file .env.docker down`
- Recreate volumes after DB credential drift: `docker compose --env-file .env.docker down -v`
- Validate rendered compose config: `docker compose --env-file .env.docker config`

## Cross-Service Wiring (easy to break)
- Gateway injects `x-service-token` on proxied requests (`microservices/gateway-service/src/app.module.ts`).
- Auth, User, Restaurant, and Order services reject non-OPTIONS requests missing valid `x-service-token`.
- Order service sends notification webhook after order creation to `NOTIFICACIONES_SERVICE_URL + /notifications` with `x-service-token` (`microservices/order-service/internal/service/order_service.go`).
- Worker endpoints are `/notifications/*` and `/health`; worker also requires `x-service-token` for health.

## Environment + Secrets Gotchas
- Always pass `--env-file .env.docker` to compose commands.
- Required root envs include: `ACCESS_TOKEN_SECRET`, `SERVICE_TOKEN`, DB passwords, `NOTIFICACIONES_SERVICE_URL`.
- Worker secret `SERVICE_TOKEN` must be set in Cloudflare runtime via `wrangler secret put SERVICE_TOKEN` (do not store in code or `wrangler.toml`).

## Focused Verify Commands
- Gateway: `cd microservices/gateway-service && npm run build`
- Auth: `cd microservices/auth-service && npm run build && npm test`
- Worker: `cd microservices/notificaciones-service && npm test && npm run typecheck`
- Order: `cd microservices/order-service && go test ./... -v`
- User: `cd microservices/user-service && dotnet test`
- Restaurant: `cd microservices/restaurant-service && DATABASE_URL='sqlite+aiosqlite:///:memory:' SECRET_KEY='test-secret' pytest tests -q`

## Docs Reliability Note
- Root `README.md` currently contains stale/conflicting sections (including unresolved merge markers). Prefer compose/service code when docs disagree.
