# Order Service — Agent Instructions

> Go 1.25+, Gin, GORM, PostgreSQL. Layered architecture: handler → service → repository.

## Quick Start

```bash
# Setup
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET in .env

# Run (auto-migrates via GORM)
go run ./cmd/api/main.go
# Expected: ✅ Database migrated successfully, 🚀 Order Service starting on port 8002

# Test all
go test ./... -v

# Single package or service layer only
go test ./internal/service/... -v

# Coverage report
go test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out
```

---

## Critical Environment Variables

| Variable | Example | Must-Have? | Notes |
|----------|---------|-----------|-------|
| `DATABASE_URL` | `postgres://postgres:password@localhost:5432/pedidos_db?sslmode=disable` | **YES** | Empty = crash on startup. Format: `postgres://user:pass@host:port/db?params` |
| `JWT_SECRET` | `your-secret-key-min-32-chars` | **YES** | Used to validate JWT signature (no auth server call). Empty = crash. |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | No | If empty/fails → uses `MockPublisher` (local logging, no error). By design. |
| `SERVER_PORT` | `8002` | No | Default 8002. Dockerfile exposes this. |
| `SERVER_ENV` | `development` or `production` | No | Maps to Gin mode (debug/release). Default: development. |

**Gotchas:**
- **Missing .env** → all vars empty → crashes on `LoadConfig()` (P1000 auth failed or connection timeout).
- **Stale DB volume after password change** → `docker compose ... down -v` (see root AGENTS.md).
- **Gin mode mapping**: `development` → `gin.DebugMode`, `production` → `gin.ReleaseMode`.

---

## Architecture & Layers

```
cmd/api/main.go
  ↓
internal/
├── config/config.go              ← .env loader, DB connect
├── middleware/
│   ├── jwt.go                    ← validates JWT signature (no auth), extracts userId/role/sub
│   └── error_handling.go         ← centralized error response formatter
├── handler/order_handler.go      ← HTTP handlers (9 endpoints)
├── service/order_service.go      ← business logic + RabbitMQ event publishing
├── repository/
│   ├── interfaces.go             ← OrderRepository contract
│   └── gorm_repository.go        ← GORM implementation (transactional)
├── model/pedido.go               ← GORM models (Pedido, PedidoItem, PedidoEstadoLog)
└── dto/order.go                  ← Request/Response DTOs
```

**Dependency injection flow:**
1. `LoadConfig()` loads .env
2. `cfg.Database.ConnectDB()` creates DB connection
3. `db.AutoMigrate(Pedido, PedidoItem, PedidoEstadoLog)` on startup (no manual migrations needed)
4. `NewGORMOrderRepository(db)` → `NewOrderService(repo, publisher, cost)` → `NewOrderHandler(service)`
5. Gin routes injected with handler

---

## Testing Patterns

### Service Layer (85%+ coverage target)
- **Location**: `internal/service/order_service_test.go`
- **Pattern**: All tests use `MockOrderRepository` (no DB required)
- **Mocking**: Interfaces defined in `internal/repository/interfaces.go` — implement mock contracts here
- **Run**: `go test ./internal/service/... -v`

### Handler / Middleware (integration via `go run`)
- No dedicated test files in `internal/handler/` — handlers are integration-tested
- To test handlers: `go run ./cmd/api/main.go` + use Postman/curl with JWT header
- Example JWT test in README.md

### Database Mocking
- **MockOrderRepository**: In-memory maps, implements full `OrderRepository` interface
- **Benefit**: Tests run without PostgreSQL, fast, isolated
- **Usage**: `NewMockOrderRepository()` in test setup

---

## Common Commands

```bash
# Verify code
go fmt ./...          # Format all
go vet ./...          # Lint

# Build binary (not required for dev)
go build -o bin/order-service ./cmd/api

# Run with specific log level
LOG_LEVEL=debug go run ./cmd/api/main.go

# Test with verbose + coverage
go test ./... -v -cover

# Test one file
go test ./internal/service/ -v -run TestCreateOrder
```

---

## Key Gotchas

### RabbitMQ Fallback
- If `RABBITMQ_URL` is empty or connection fails → **silently uses `MockPublisher`** (by design, no error)
- Mock logs events locally: `"Using MockPublisher"` in logs
- This is intentional for local dev; don't force real RabbitMQ in early iteration

### JWT Validation (NOT Authentication)
- Service validates **signature only** using `JWT_SECRET`
- Extracts claims: `userId`, `role` (`usuario` | `repartidor` | `admin`), `sub`
- **Gateway validates authenticity** (auth server call, token revocation, etc.)
- Service checks role for route access (see `middleware.RequireRole()`)
- No database lookup; trust the token if signature is valid

### Database Auto-Migration
- `main.go` calls `db.AutoMigrate(&model.Pedido{}, &model.PedidoItem{}, &model.PedidoEstadoLog{})`
- **No separate migration files needed** — GORM infers schema from struct tags
- On startup, GORM creates/updates tables if missing or schema changed
- Migrations run even if service restarts (idempotent)

### State Transitions (Validation)
- Order states: `pendiente` → `aceptado` → `en_camino` → `entregado` (or `cancelado` from `pendiente`)
- Service layer validates transitions; invalid transitions return `INVALID_STATE_TRANSITION` error
- Only `usuario` can cancel; only `repartidor` can accept/update status

### Docker Build
- Uses `CGO_ENABLED=0` (pure Go, no cgo dependencies)
- If you add a cgo-dependent lib (e.g., SQLite, C bindings), build fails
- Solution: Remove cgo dependency or enable cgo in Alpine (adds complexity, usually not needed)

---

## API Response Format

All errors follow centralized format (from `pkg/errors/errors.go`):

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": { "field": "items", "issue": "must not be empty" },
  "timestamp": "2026-04-13T10:30:00Z",
  "requestId": "uuid"
}
```

**Error codes → HTTP status**:
- `VALIDATION_ERROR` → 400
- `UNAUTHORIZED` → 401
- `FORBIDDEN` → 403
- `NOT_FOUND` → 404
- `INVALID_STATE_TRANSITION` → 400
- `CONFLICT` → 409
- `INTERNAL_ERROR` → 500

---

## RabbitMQ Events (5 types)

Published on state changes (if RabbitMQ connected):
1. `order.created` — order created
2. `order.assigned` — repartidor accepted
3. `order.status.changed` — state updated
4. `order.delivered` — marked as entregado
5. `order.cancelled` — marked as cancelado

Event payload includes order ID, new state, timestamp, and relevant metadata.
See `internal/service/order_service.go` for event construction.

---

## Debugging Checklist

**"Service won't start"**
1. Check `.env` exists: `ls -la .env`
2. Verify `DATABASE_URL` matches format (no typos in password/host)
3. Run: `go run ./cmd/api/main.go` (see full error)
4. If `P1000` or password auth failed: DB credentials mismatch → re-init with `docker compose ... down -v`
5. If "bind: address already in use" → port 8002 in use → change `SERVER_PORT` or kill existing process

**"Tests fail with mock not injected"**
1. Ensure you're in `microservices/order-service/` directory
2. Run `go test ./internal/service/... -v`
3. `MockOrderRepository` is only used in service tests; handlers tested via `go run`

**"JWT validation fails"**
1. Token must include `userId`, `role`, `sub` claims
2. Signature uses same `JWT_SECRET` as `.env`
3. Check middleware: `internal/middleware/jwt.go`
4. Valid roles: `usuario`, `repartidor`, `admin`

**"RabbitMQ not publishing events"**
1. If `RABBITMQ_URL` empty → using `MockPublisher` (check logs for `"Using MockPublisher"`)
2. If real RabbitMQ: verify connection string format (`amqp://user:pass@host:port/`)
3. Check logs for actual RabbitMQ errors or mock fallback

---

## File Structure (Quick Ref)

| Path | Purpose |
|------|---------|
| `cmd/api/main.go` | Entry point: config, DB, RabbitMQ, Gin setup |
| `internal/config/config.go` | Load .env, validate, connect DB |
| `internal/middleware/jwt.go` | JWT validation & role checks |
| `internal/handler/order_handler.go` | 9 HTTP endpoints |
| `internal/service/order_service.go` | Business logic + event publish |
| `internal/service/order_service_test.go` | Unit tests (MockRepository) |
| `internal/repository/gorm_repository.go` | GORM + transactions |
| `internal/model/pedido.go` | GORM models |
| `pkg/jwt/claims.go` | JWT claim structs |
| `pkg/rabbitmq/publisher.go` | RabbitMQ + MockPublisher |
| `pkg/errors/errors.go` | Centralized error codes |
| `Dockerfile` | Multi-stage build (Go + Alpine) |

---

## References

- Full API spec: `API.md` (in this directory)
- README.md: Feature overview, example requests
- Root `AGENTS.md`: Multi-service context, Docker Compose, cross-service gotchas
