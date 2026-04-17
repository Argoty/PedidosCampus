# AGENTS.md

## Repository State

This is a microservices mono-repo: **PedidosCampus** (campus delivery platform).

**Current focus: `order-service`** (Go 1.25, Gin, GORM, PostgreSQL, RabbitMQ)

- Executable microservice at `microservices/order-service/` ✅
- Local Docker Compose orchestration (auth-service, order-service, databases) at root
- Postman collections at `postman/` (service-specific)

If you're in a different service directory (e.g., auth-service), cross-reference that README first.

---

## Truth Sources (in order of priority)

1. **Executable config**: 
   - `microservices/order-service/go.mod` (Go 1.25+, Gin, GORM)
   - `microservices/order-service/Dockerfile` (Alpine, binary at `cmd/api`)
   - `microservices/order-service/.env.example` (DATABASE_URL, JWT_SECRET, RABBITMQ_URL)
   - `microservices/order-service/cmd/api/main.go` (entry point, DB auto-migration, RabbitMQ init)

2. **Operational docs**:
   - `microservices/order-service/README.md` (commands, API endpoints, testing)
   - `microservices/order-service/API.md` (full endpoint reference, models, error codes)

3. **Architecture**:
   - `microservices/order-service/internal/` tree structure (config → model → repository → service → handler)
   - Root `docker-compose.yml` for local stack

On conflict: **always trust executable sources over prose**.

---

## Verified Commands

### Local Development (Go 1.25+)

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

# 5. Linting / verification (if configured)
go fmt ./...
go vet ./...
```

### Docker Stack (Recommended)

```bash
cd /home/simondavid/Escritorio/DEVELOP/PedidosCampus

# Start all services (auth + order + databases)
docker compose --env-file .env.docker up --build

# View logs
docker compose --env-file .env.docker logs -f order-service

# Stop
docker compose --env-file .env.docker down
```

**Important**: Always pass `--env-file .env.docker` or Docker uses empty env vars (failure on startup).

---

## Architecture & Code Layout

```
microservices/order-service/
├── cmd/api/main.go                    # Entry point: loads config, migrates DB, inits RabbitMQ, starts Gin
├── internal/
│   ├── config/config.go               # LoadConfig() → reads .env, connects PostgreSQL
│   ├── model/
│   │   └── pedido.go                  # GORM models: Pedido, PedidoItem, PedidoEstadoLog
│   ├── repository/
│   │   ├── interfaces.go              # OrderRepository interface (testable contract)
│   │   └── gorm_repository.go         # GORM implementation (transactional ops)
│   ├── service/
│   │   ├── interfaces.go              # OrderService interface
│   │   ├── order_service.go           # Business logic + event publishing (5 event types)
│   │   └── order_service_test.go      # Unit tests with MockOrderRepository (85%+ coverage)
│   ├── handler/
│   │   ├── order_handler.go           # 9 HTTP endpoints (POST/GET, user/admin)
│   │   └── helpers.go                 # DTO → Model mapping
│   ├── dto/
│   │   └── order.go                   # Request/Response objects
│   └── middleware/
│       └── jwt.go                     # JWT validation (signature check, claim parsing)
├── pkg/
│   ├── jwt/claims.go                  # JWT claim structs (userId, role, sub)
│   ├── rabbitmq/publisher.go          # Event publisher: RabbitMQ + MockPublisher fallback
│   └── errors/errors.go               # Centralized error codes + HTTP mapping
├── migrations/                        # (empty; GORM handles via AutoMigrate)
├── go.mod, go.sum
├── .env.example, .env (gitignored)
└── Dockerfile
```

### Key Flow

1. **Request** → Gin handler validates JWT via middleware
2. **Handler** calls Service (business logic layer)
3. **Service** calls Repository (data access)
4. **Repository** executes GORM transaction, publishes RabbitMQ event
5. **Response** uses centralized error codes (`errors.go`)

---

## Critical Gotchas

### Database / Configuration

- **Auto-migration**: `main.go` calls `db.AutoMigrate(Pedido, PedidoItem, PedidoEstadoLog)` on startup. No manual migrations needed.
- **DATABASE_URL** must match format: `postgres://user:pass@host:port/dbname`
- **Missing .env** → all defaults = `""`, service fails to connect at startup (check logs for `P1000` or DNS errors).
- **Stale DB volume in Docker**: If you change `POSTGRES_PASSWORD` after init, Docker's volume retains old credentials.
  - **Solution**: `docker compose --env-file .env.docker down -v && docker compose --env-file .env.docker up --build`

### JWT & Authorization

- JWT validation is **signature-check only** (no auth server call).
- Valid roles: `usuario`, `repartidor`, `admin`.
- All endpoints require `Authorization: Bearer {token}` header.
- Service extracts `userId`, `role`, `sub` from claims; handler enforces resource ownership or role check.
- **No authn here**: Gateway or central middleware validates token authenticity.

### RabbitMQ Events

- 5 event types: `order.created`, `order.assigned`, `order.status.changed`, `order.delivered`, `order.cancelled`
- If RabbitMQ URL is empty or connection fails → **silently uses MockPublisher** (logs events locally, does not error).
- Mock is intentional for local dev; don't force real RabbitMQ in early iteration.

### Testing

- All service tests use **MockOrderRepository** (no DB required).
- Tests live in `order_service_test.go` only; handler and middleware are integration-tested via `go run` or Docker.
- **85%+ coverage target** on service layer (business rules).

---

## Environment & .env Pattern

**Never commit `.env` (gitignored).**

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

---

## Common Tasks

### "Service won't start"

1. Check `.env` exists and `DATABASE_URL` is valid.
2. Run `docker compose --env-file .env.docker logs order-service` (if Docker) to see actual error.
3. If `P1000` or "password authentication failed" → DB credentials mismatch; re-init with `down -v`.
4. If Gin crashes on startup → missing required env vars (check `config.LoadConfig()`).

### "Tests fail / mock not injected"

1. Ensure you're in `microservices/order-service/` directory.
2. Run `go test ./internal/service/... -v` to isolate service tests.
3. MockOrderRepository is hardcoded in `order_service_test.go`; if you're testing handlers, use `go run` instead (integration test).

### "RabbitMQ events not published"

1. Check `RABBITMQ_URL` in `.env` (if empty, uses MockPublisher by design).
2. If real RabbitMQ: verify connection string format (`amqp://user:pass@host:port/`).
3. Check service logs for `"Using MockPublisher"` or actual RabbitMQ connection attempt.

### "JWT validation fails"

1. Ensure token includes `userId`, `role`, `sub` claims.
2. Verify token signature uses same `JWT_SECRET` as `.env`.
3. Check middleware code (`pkg/jwt/claims.go`, `middleware/jwt.go`) for expected claim names.

### "Docker build fails on CGO"

- Dockerfile uses `CGO_ENABLED=0` (pure Go binary). If you add cgo-dependent libs, the build will fail.
- Solution: Remove cgo dependency or enable cgo in Alpine (adds build complexity, usually not needed).

---

## Academic Scope (Respect This)

- **First delivery**: Microservices exist independently (no active inter-service calls).
- **Don't assume**: 
  - Gateway is NOT operational (verify in `docker-compose.yml`).
  - RabbitMQ is NOT mandatory for local dev (MockPublisher fallback exists).
  - User Service or Restaurant Service integration is NOT implemented yet.

---

## References

- Full API spec: `microservices/order-service/API.md`
- Academic requirements: `docs/RequisitosFuncionales.md` (at repo root)
- Root orchestration: `docker-compose.yml` + `.env.docker`

