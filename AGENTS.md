# AGENTS.md

## Repository State

This is a microservices mono-repo: **PedidosCampus** (campus delivery platform).

**Stack ejecutable con Docker Compose en raíz**: múltiples microservicios
- `order-service` (Go 1.25, Gin, GORM) — **current focus**
- `auth-service` (NestJS + Prisma + PostgreSQL)
- `user-service` (ASP.NET 8 + EF Core + PostgreSQL)
- `notificaciones-service` (Cloudflare Workers + KV)
- `restaurant-service` (placeholder)

---

## Truth Sources (in order of priority)

### For Any Service
1. **Executable config**: 
   - Root `docker-compose.yml` (qué realmente corre)
   - Service-specific: `go.mod`, `package.json`, `*.csproj`, `wrangler.toml`
   - Service-specific: `Dockerfile`, `.env.example`
   - Service-specific: entry point (`main.go`, `main.ts`, `Program.cs`, `index.ts`)

2. **Operational docs**:
   - Service-specific `README.md` (commands, API, testing)
   - Service-specific `API.md` (full endpoint reference)

3. **Architecture**:
   - Service-specific source layout (`internal/`, `src/`, etc.)
   - Root `docker-compose.yml` for orchestration context

**On conflict**: always trust executable sources over prose.

---

## Verified Commands

### Docker Stack (All Services)

```bash
cd /home/simondavid/Escritorio/DEVELOP/PedidosCampus

# Start all services
docker compose --env-file .env.docker up --build

# View logs (e.g., order-service)
docker compose --env-file .env.docker logs -f order-service

# Stop all
docker compose --env-file .env.docker down

# Reset (if DB credentials changed)
docker compose --env-file .env.docker down -v
```

**Important**: Always pass `--env-file .env.docker` or Docker uses empty env vars (crash on startup).

---

## ORDER-SERVICE (Go 1.25+)

### Local Development

```bash
cd microservices/order-service

# 1. Setup
go mod download
cp .env.example .env
# Edit .env: DATABASE_URL=postgres://user:pass@localhost:5432/pedidos_db

# 2. Run (auto-migrates DB via GORM)
go run ./cmd/api/main.go
# Expected output: "✅ Database migrated successfully" + "🚀 Order Service starting on port 8002"

# 3. Build binary
go build -o bin/order-service ./cmd/api
./bin/order-service

# 4. Testing
go test ./...                    # All tests
go test ./... -v                 # Verbose
go test ./internal/service/...   # Service layer only (85%+ coverage)
go test ./... -cover             # Coverage summary
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out # HTML report

# 5. Linting / verification
go fmt ./...
go vet ./...
```

### Architecture & Code Layout

```
microservices/order-service/
├── cmd/api/main.go                    # Entry point: config, DB auto-migration, RabbitMQ, Gin
├── internal/
│   ├── config/config.go               # LoadConfig() → reads .env, connects PostgreSQL
│   ├── model/pedido.go                # GORM models: Pedido, PedidoItem, PedidoEstadoLog
│   ├── repository/
│   │   ├── interfaces.go              # OrderRepository interface (testable contract)
│   │   └── gorm_repository.go         # GORM implementation (transactional)
│   ├── service/
│   │   ├── interfaces.go              # OrderService interface
│   │   ├── order_service.go           # Business logic + RabbitMQ event publishing
│   │   └── order_service_test.go      # Unit tests with MockOrderRepository (85%+ coverage)
│   ├── handler/
│   │   ├── order_handler.go           # 9 HTTP endpoints (POST/GET, user/admin)
│   │   └── helpers.go                 # DTO → Model mapping
│   ├── dto/order.go                   # Request/Response objects
│   └── middleware/jwt.go              # JWT validation (signature check, claim parsing)
├── pkg/
│   ├── jwt/claims.go                  # JWT claim structs (userId, role, sub)
│   ├── rabbitmq/publisher.go          # RabbitMQ publisher + MockPublisher fallback
│   └── errors/errors.go               # Centralized error codes + HTTP mapping
├── migrations/                        # (empty; GORM handles via AutoMigrate)
├── go.mod, go.sum, Dockerfile
└── .env.example, API.md, README.md
```

### Key Flow
1. **Request** → Gin handler validates JWT via middleware
2. **Handler** calls Service (business logic)
3. **Service** calls Repository (data access)
4. **Repository** executes GORM transaction, publishes RabbitMQ event
5. **Response** uses centralized error codes

### Critical Gotchas

**Database / Configuration:**
- **Auto-migration**: `main.go` calls `db.AutoMigrate(Pedido, PedidoItem, PedidoEstadoLog)` on startup. No manual migrations needed.
- **DATABASE_URL** must match format: `postgres://user:pass@host:port/dbname`
- **Missing .env** → all defaults = `""`, service fails to connect (check logs for `P1000` or DNS errors).
- **Stale DB volume in Docker**: If you change `POSTGRES_PASSWORD` after init, Docker's volume retains old credentials.
  - **Solution**: `docker compose --env-file .env.docker down -v && docker compose --env-file .env.docker up --build`

**JWT & Authorization:**
- JWT validation is **signature-check only** (no auth server call).
- Valid roles: `usuario`, `repartidor`, `admin`.
- All endpoints require `Authorization: Bearer {token}` header.
- Service extracts `userId`, `role`, `sub` from claims; handler enforces resource ownership or role check.
- **No authn here**: Gateway validates token authenticity.

**RabbitMQ Events:**
- 5 event types: `order.created`, `order.assigned`, `order.status.changed`, `order.delivered`, `order.cancelled`
- If RabbitMQ URL is empty or connection fails → **silently uses MockPublisher** (logs locally, does not error).
- Mock is intentional for local dev; don't force real RabbitMQ in early iteration.

**Testing:**
- All service tests use **MockOrderRepository** (no DB required).
- Tests live in `order_service_test.go` only; handler/middleware are integration-tested via `go run` or Docker.
- **85%+ coverage target** on service layer (business rules).

**Docker build:**
- Dockerfile uses `CGO_ENABLED=0` (pure Go binary). If you add cgo-dependent libs, the build will fail.
- Solution: Remove cgo dependency or enable cgo in Alpine (adds complexity, usually not needed).

### Environment Variables (order-service)

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgres://postgres:password@localhost:5432/pedidos_db` | Required; empty = crash |
| `JWT_SECRET` | `your-secret-key-min-32-chars` | Used to validate JWT signature |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | Optional; empty = MockPublisher |
| `RABBITMQ_EXCHANGE` | `pedidos_exchange` | Used if RabbitMQ_URL set |
| `RABBITMQ_QUEUE_PREFIX` | `pedidos` | Prefixes queue names for routing |
| `LOG_LEVEL` | `info` or `debug` | Verbosity for DB/service logs |
| `SERVER_PORT` | `8002` | Default 8002 (Dockerfile exposes this) |
| `SERVER_ENV` | `development` or `production` | Affects Gin mode, log formatting |

### Common Tasks

**"Service won't start"**
1. Check `.env` exists and `DATABASE_URL` is valid.
2. Run `docker compose --env-file .env.docker logs order-service` to see actual error.
3. If `P1000` or "password authentication failed" → DB credentials mismatch; re-init with `down -v`.
4. If Gin crashes on startup → missing required env vars (check `config.LoadConfig()`).

**"Tests fail / mock not injected"**
1. Ensure you're in `microservices/order-service/` directory.
2. Run `go test ./internal/service/... -v` to isolate service tests.
3. MockOrderRepository is hardcoded in `order_service_test.go`; if testing handlers, use `go run` (integration test).

**"RabbitMQ events not published"**
1. Check `RABBITMQ_URL` in `.env` (if empty, uses MockPublisher by design).
2. If real RabbitMQ: verify connection string format (`amqp://user:pass@host:port/`).
3. Check service logs for `"Using MockPublisher"` or actual RabbitMQ connection attempt.

**"JWT validation fails"**
1. Ensure token includes `userId`, `role`, `sub` claims.
2. Verify token signature uses same `JWT_SECRET` as `.env`.
3. Check middleware code (`pkg/jwt/claims.go`, `middleware/jwt.go`) for expected claim names.

---

## OTHER SERVICES (Context for Multi-Service Development)

### AUTH-SERVICE (NestJS + Prisma)

```bash
cd microservices/auth-service

# Local setup
npm install
npm run prisma:generate
npm run prisma:push
npm run start:dev

# Tests
npm test

# Build output for prod: dist/src/main.js
```

**Gotchas:**
- In Docker, `prisma db push` runs on startup (in `CMD`), not versioned migrations.
- Build output real path: `dist/src/main.js` (script `start:prod`), not `dist/main.js`.

### USER-SERVICE (ASP.NET 8 + EF Core)

```bash
cd microservices/user-service

# Local setup
dotnet restore
dotnet run          # or `dotnet watch run` for auto-reload

# Tests
dotnet test

# Migrations: in Development, Program.cs executes dbContext.Database.Migrate() on startup
```

### NOTIFICACIONES-SERVICE (Cloudflare Workers + KV)

```bash
cd microservices/notificaciones-service

# Setup
npm install
npx wrangler login
npx wrangler kv namespace create NOTIFICATIONS
# Copy 'id' and 'preview_id' to wrangler.toml

# Dev mode (local on http://127.0.0.1:8787)
npm run dev

# Tests
npm test

# Deploy to Workers
npm run deploy
```

**Gotchas:**
- Each notification stores 2 KV keys by design (`notif:*` + `notif_id:*`); not accidental duplication.
- `wrangler.toml` includes `id` and `preview_id` of namespace KV; these IDs are not secrets.
- `wrangler dev` uses KV local by default; to use remote KV during dev: `npx wrangler dev --remote`.

### Ports & Host Mapping

| Service | API Port | DB Port | Notes |
|---------|----------|---------|-------|
| Auth | 3001 | 5433 | NestJS + Postgres |
| User | 5000 | 5434 | ASP.NET 8 + Postgres |
| Order | 8002 | (shared) | Go + Postgres |
| Notificaciones | 8787 | (KV) | Workers (no DB) |

---

## Global Gotchas

**Docker Compose:**
- Use ALWAYS `--env-file .env.docker` or sensitive env vars are empty.
- `AUTH_DB_PASSWORD`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, etc. have no secure fallback.
- If you change any DB password after init, Docker volume retains old credentials → `down -v` required.

**Confusing Locations:**
- Architecture diagram: `docs/diagramaMicroservicios.mmd` (lowercase!).
- Postman collections: `postman/auth-service.postman_collection.json`, `postman/user-service.postman_collection.json`, `postman/notificaciones-service.postman_collection.json`.

**Academic Scope:**
- **First delivery**: Microservices exist independently (no active inter-service calls).
- **Don't assume**: 
  - Gateway is NOT operational (verify in `docker-compose.yml`).
  - RabbitMQ is NOT mandatory for local dev (MockPublisher fallback exists).
  - Inter-service integration (User Service, Restaurant Service) is NOT implemented yet.

---

## References

- Order Service API spec: `microservices/order-service/API.md`
- Academic requirements: `docs/RequisitosFuncionales.md`
- Root orchestration: `docker-compose.yml` + `.env.docker`

