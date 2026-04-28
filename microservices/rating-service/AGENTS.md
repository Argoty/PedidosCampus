# AGENTS.md — Rating Service

## Scope
Microservicio calificaciones (reseñas) para restaurantes y repartidores. PostgreSQL + Axum (Rust). Asociado a pedidos completados.

## Quick Start

### Instalar dependencias
```bash
cd microservices/rating-service
rustup update
cargo build
```

### Dev run
```bash
RUST_LOG=debug DATABASE_URL="postgresql://rating_user:rating_password@localhost:5437/rating_db" cargo run
```

### Tests unitarios
```bash
cargo test --lib -- --nocapture
```

### Docker compose
```bash
cd /home/simondavid/Escritorio/DEVELOP/PedidosCampus
docker compose --env-file .env.docker up --build
```

## Database Setup

Schema PostgreSQL basado en `calificaciones-schema.prisma`:
- Tabla `calificaciones_restaurante` (restaurante ratings)
- Tabla `calificaciones_repartidor` (delivery ratings)
- PKs: UUID
- Índices en `restauranteId`, `repartidorId`, `userId`
- Constraint único: `(pedidoId, userId)` per tabla

Conexión en compose:
- Host: `rating-db:5432` (Docker)
- Host local dev: `localhost:5437`
- User: `rating_user`
- DB: `rating_db`

## Architecture

Patrón hexagonal. Estructura:
```
src/
├── main.rs              # Entry + setup
├── app.rs               # Router + server config
├── routes/mod.rs        # Rutas agrupadas
├── handlers/            # HTTP handlers por modelo
│   ├── rating_restaurant_handler.rs
│   └── rating_delivery_handler.rs
├── services/            # Lógica de negocio
│   ├── rating_restaurant_service.rs
│   └── rating_delivery_service.rs
├── repositories/        # DB queries
│   ├── rating_restaurant_repo.rs
│   └── rating_delivery_repo.rs
├── models/              # Domain entities
│   ├── restaurant_rating.rs
│   └── delivery_rating.rs
├── dto/                 # Request/response DTOs
│   ├── rating_request.rs
│   └── rating_response.rs
├── config/mod.rs        # DB pool, env
├── errors/app_error.rs  # Custom error types
└── state.rs             # AppState (pool)
```

## Endpoints

Ref: **API.md** (en raíz del servicio)

CRUD operaciones:
- `POST /ratings/restaurant` — crear calificación restaurante
- `GET /ratings/restaurant/:id` — obtener por ID
- `GET /ratings/restaurant/user/:userId` — listar por usuario
- `GET /ratings/restaurant/restaurant/:restauranteId` — listar por restaurante
- `PATCH /ratings/restaurant/:id` — actualizar
- `DELETE /ratings/restaurant/:id` — eliminar

Mismo patrón para repartidores (`/ratings/delivery/*`).

## Environment (.env.docker)

```
RATING_DB_PASSWORD=rating_password
CALIFICACIONES_DATABASE_URL=postgresql://rating_user:${RATING_DB_PASSWORD}@rating-db:5432/rating_db?sslmode=disable
```

## Checks Antes de Commit

- [ ] `cargo test --lib` — todos green
- [ ] `cargo build --release` — sin warnings
- [ ] Endpoints en Postman probados
- [ ] Logs claros (structured tracing)
- [ ] No secrets en código

## Common Issues

**Error: "connection refused"**
- Verifica que `rating-db` está healthy: `docker compose ps`
- Espera 10s después de `docker compose up`

**Error: "table doesn't exist"**
- Ejecuta migrations: schema se crea automático en primera conexión (sqlx default)
- Si persiste, drop DB: `docker compose down -v && docker compose up --build`

**Compilation error con tokio features**
- `Cargo.toml` tiene `tokio = { ... features = ["full"] }` — full runtime
- En prod, cambiar a `["rt-multi-thread", "macros", "sync"]`

## Testing Strategy

Unitarios:
- Handlers: mock de services
- Services: mock de repos
- Repos: real DB con `sqlx::test` o similar

Integración (Postman):
- Flujo completo: crear → leer → actualizar → eliminar

## Logging

Stack: `tracing` + `tracing-subscriber` (JSON en prod, pretty en dev).

Vars de env:
```
RUST_LOG=debug           # Nivel
LOG_FORMAT=json          # "json" o "pretty"
```

## Related Services

- **auth-service** — valida JWT en Authorization header
- **user-service** — valida existencia de usuarios
- **restaurant-service** — valida existencia de restaurantes
- **order-service** — pedidos completados triggerean ratings

Actualmente: sin validaciones cruzadas (referencias lógicas). Arquitectura lista para event-driven cuando sea necesario.
