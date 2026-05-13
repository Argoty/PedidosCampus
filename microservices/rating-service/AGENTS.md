# AGENTS.md — Rating Service

## Scope
Microservicio calificaciones (reseña) para restaurantes y repartidores. PostgreSQL + Axum (Rust). Receptor de eventos RabbitMQ para pedidos entregados.

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

## Environment

Vars requeridas:
- `DATABASE_URL` — conexión PostgreSQL (default: `postgresql://rating_user:rating_password@localhost:5437/rating_db`)
- `PORT` — puerto HTTP (default: `8003`)
- `RABBITMQ_URL` — conexión RabbitMQ (default: `amqp://guest:guest@rabbitmq:5672/`)
- `RABBITMQ_EXCHANGE` — exchange RabbitMQ (default: `orders`)
- `RABBITMQ_QUEUE` — cola consumidores (default: `rating-service`)
- `RUST_LOG` — nivel logging (default: `info`)
- `LOG_FORMAT` — formato (`json` o `pretty`)

Compose usa:
- Host DB: `rating-db:5432`
- Host RabbitMQ: `rabbitmq:5672`

## Database Schema

Tablas creadas automáticamente en init:
- `calificaciones_restaurante` — ratings de restaurantes (pedidoId+userId único)
- `calificaciones_repartidor` — ratings de repartidores (pedidoId+userId único)
- `pedidos_entregados` — track de pedidos entregados vía RabbitMQ

Índices en columnas foreign key de cada tabla.

## Estructura Archivos

```
src/
├── main.rs              # Entry + setup + RabbitMQ consumer
├── app.rs              # Router + middleware
├── routes.rs           # Definición rutas + Swagger OpenAPI
├── state.rs           # AppState (pool + delivered_order_service)
├── config.rs           # DB pool init + migrations
├── models.rs           # Domain entities (RestaurantRating, DeliveryRating, DeliveredOrder, RatingStats)
├── dto.rs              # Request/response DTOs
├── errors.rs           # Custom error types
├── restaurant_handler.rs   # HTTP handlers restaurantes
├── restaurant_repository.rs # DB queries restaurantes
├── restaurant_service.rs  # Lógica negocio restaurantes
├── delivery_handler.rs    # HTTP handlers repartidores
├── delivery_repository.rs  # DB queries repartidores
├── delivery_service.rs    # Lógica negocio repartidores
├── delivery_order_service.rs  # Servicio pedidos entregados
├── delivery_order_repo.rs    # Repo pedidos entregados
└── rabbitmq/
    ├── mod.rs           # RabbitMQ mod
    └── consumer.rs      # Consumer eventos order.delivered
```

## Endpoints

### Restaurant ratings
- `POST /ratings/restaurant` — crear rating
- `GET /ratings/restaurant/:id` — obtener por ID
- `GET /ratings/restaurant/user/:userId` — listar por usuario
- `GET /ratings/restaurant/restaurant/:restauranteId` — listar por restaurante
- `PATCH /ratings/restaurant/:id` — actualizar
- `DELETE /ratings/restaurant/:id` — eliminar
- `GET /ratings/stats/restaurant/:restauranteId` — estadísticas

### Delivery ratings
- `POST /ratings/delivery` — crear rating
- `GET /ratings/delivery/:id` — obtener por ID
- `GET /ratings/delivery/user/:userId` — listar por usuario
- `GET /ratings/delivery/delivery/:repartidorId` — listar por repartidor
- `PATCH /ratings/delivery/:id` — actualizar
- `DELETE /ratings/delivery/:id` — eliminar
- `GET /ratings/stats/delivery/:repartidorId` — estadísticas

### Health
- `GET /health` — health check
- `GET /swagger-ui` — Swagger UI
- `GET /api-docs/openapi.json` — OpenAPI spec

Puerto default: `8003`. Ref API completa: **API.md**.

## RabbitMQ Integration

Consumer escucha eventos `order.delivered` desde cola configurada. Procesa mensaje, persiste en `pedidos_entregados`. Habilita ratings automáticos post-entrega. Si RabbitMQ falla al iniciar, servicio continúa sin recibir eventos (warning en logs).

## Checks Antes de Commit

- [ ] `cargo test --lib` — todos green
- [ ] `cargo build --release` — sin warnings
- [ ] Endpoints probados (Postman/curl)
- [ ] `RUST_LOG=debug` muestra logs claros
- [ ] No secrets hardcodeados

## Common Issues

**Error: "connection refused"**
- Verificar rating-db healthy: `docker compose ps`
- Esperar 10s tras `docker compose up`

**Error: "table doesn't exist"**
- Migrations corren automático en primera conexión
- Si persiste: `docker compose down -v && docker compose up --build`

**RabbitMQ consumer no conecta**
- Verificar `RABBITMQ_URL` correcta
- Verificar exchange/queue existen en RabbitMQ
- Logs muestran error o warning de fallback

**Compilation error tokio**
- `Cargo.toml` usa `features = ["full"]` — runtime completo
- Prod cambiar a `["rt-multi-thread", "macros", "sync"]`

## Testing Strategy

Unitarios:
- Handlers: mock services
- Services: mock repositories
- Repos: tests integrados con `#[sqlx::test]`

Integración:
- Flujo completo POST → GET → PATCH → DELETE
- Probar stats endpoints
- Verificar constraint único (pedidoId+userId)

## Logging

Stack: `tracing` + `tracing-subscriber`. Formato JSON en prod, pretty en dev. Nivel controlado por `RUST_LOG`.

## Related Services

- **auth-service** — valida JWT
- **user-service** — valida usuarios
- **restaurant-service** — valida restaurantes
- **order-service** — publica eventos `order.delivered`
- **notificaciones-service** — webhooks notificaciones

Actualmente sin validaciones cruzadas. Arquitectura lista para event-driven. Ratings solo requieren pedidoId válido (FK lógica).