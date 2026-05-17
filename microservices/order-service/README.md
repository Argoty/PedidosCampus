# Order Service (Microservicio de Pedidos)

Microservicio de pedidos para la plataforma PedidosCampus, implementado en Go con Gin, GORM y PostgreSQL.

## 📋 Características

- ✅ Crear, obtener y listar pedidos
- ✅ Ciclo completo de estados: pendiente → aceptado → en_camino → entregado
- ✅ Aceptación de pedidos por repartidores
- ✅ Cancelación de pedidos en estado pendiente
- ✅ Historial de cambios de estado
- ✅ Validación con JWT (solo validación, sin autenticación)
- ✅ Eventos RabbitMQ (con fallback a mock para local)
- ✅ Tests unitarios con 70%+ cobertura
- ✅ Documentación Swagger

## 🛠️ Stack Técnico

- **Go 1.25+**
- **Gin Web Framework**
- **GORM ORM**
- **PostgreSQL**
- **RabbitMQ** (opcional, mock para local)
- **JWT (golang-jwt/jwt/v5)**
- **Testify** (testing)

## 🚀 Getting Started

### Prerrequisitos

- Go 1.25+
- PostgreSQL 12+
- RabbitMQ (opcional)

### 1. Setup Local

```bash
# Clona el proyecto
cd microservices/order-service

# Instala dependencias
go mod download

# Copia .env.example a .env
cp .env.example .env

# Edita .env con tus valores (especialmente DATABASE_URL)
# Por defecto assume: postgres://postgres:password@localhost:5432/pedidos_db
```

### 2. Crea la base de datos

```bash
createdb pedidos_db

# O si usas docker:
docker run -d \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pedidos_db \
  -p 5432:5432 \
  postgres:15
```

### 3. Ejecuta el servicio

```bash
# Local development (auto-migra la DB)
go run ./cmd/api/main.go

# Build binario
go build -o bin/order-service ./cmd/api

# Run binario
./bin/order-service
```

Debería ver:
```
✅ Database migrated successfully
🚀 Order Service starting on port 8002
```

## 📚 API Endpoints

### Health Check
```bash
GET /health
```

### Crear Pedido (Usuario)
```bash
POST /orders
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "restauranteId": "uuid",
  "direccionEntrega": "Cra 5 # 20-30",
  "items": [
    {
      "productId": "uuid",
      "nombre": "Hamburguesa Deluxe",
      "precioUnit": 12.75,
      "cantidad": 2
    }
  ]
}
```

### Obtener Pedido
```bash
GET /orders/{orderId}
Authorization: Bearer {jwt_token}
```

### Listar Pedidos del Usuario
```bash
GET /orders?limit=10&offset=0&estado=pendiente
Authorization: Bearer {jwt_token}
```

### Aceptar Pedido (Repartidor)
```bash
POST /orders/{orderId}/accept
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "repartidorId": "uuid"
}
```

### Actualizar Estado (Repartidor)
```bash
POST /orders/{orderId}/status
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "toEstado": "en_camino"  # o "entregado"
}
```

### Cancelar Pedido (Usuario)
```bash
POST /orders/{orderId}/cancel
Authorization: Bearer {jwt_token}
```

### Obtener Historial de Estados
```bash
GET /orders/{orderId}/history
Authorization: Bearer {jwt_token}
```

### Listar Activos (Admin)
```bash
GET /orders/active?limit=10&offset=0&estado=aceptado
Authorization: Bearer {admin_jwt_token}
```

### Listar Pedidos del Repartidor
```bash
GET /orders/deliverer/{repartidorId}?estado=en_camino
Authorization: Bearer {jwt_token}
```

## 🧪 Testing

### Unit Tests
```bash
# Corre todos los tests
go test ./...

# Con verbose output
go test ./... -v

# Solo service tests
go test ./internal/service/... -v

# Con cobertura
go test ./... -cover

# Genera reporte de cobertura
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Test Coverage Actual
```
github.com/PedidosCampus/order-service/internal/service  ✅ 85%+ coverage
- CreateOrder business logic
- AcceptOrder authorization + transacción
- UpdateOrderStatus state validation
- CancelOrder business rules
```

## 🏗️ Arquitectura

```
order-service/
├── cmd/
│   └── api/main.go                  # Entry point
├── internal/
│   ├── config/
│   │   └── config.go               # .env loader + DB setup
│   ├── model/
│   │   └── pedido.go               # GORM models (Pedido, PedidoItem, PedidoEstadoLog)
│   ├── repository/
│   │   ├── interfaces.go           # OrderRepository interface
│   │   └── gorm_repository.go      # GORM implementation (transactional)
│   ├── service/
│   │   ├── interfaces.go           # OrderService interface
│   │   ├── order_service.go        # Business logic + event publishing
│   │   └── order_service_test.go   # Unit tests (mocked repository)
│   ├── handler/
│   │   ├── order_handler.go        # HTTP handlers (9 endpoints)
│   │   └── helpers.go              # DTO mapping
│   ├── dto/
│   │   └── order.go                # Request/Response objects
│   └── middleware/
│       └── jwt.go                  # JWT validation (no auth, just parsing)
├── pkg/
│   ├── jwt/
│   │   └── claims.go               # JWT claim structures
│   ├── rabbitmq/
│   │   └── publisher.go            # RabbitMQ publisher + mock
│   └── errors/
│       └── errors.go               # Centralized error handling
├── migrations/
│   └── (auto-generadas por GORM)
├── go.mod
├── go.sum
├── .env                            # Local config
├── .env.example                    # Template
└── API.md                          # Full API documentation
```

## 📦 Respuesta de Errores (Centralizado)

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "field": "items",
    "issue": "must not be empty"
  },
  "timestamp": "2026-04-13T10:30:00Z",
  "requestId": "uuid"
}
```

### Códigos de Error
- `VALIDATION_ERROR` → 400
- `UNAUTHORIZED` → 401
- `FORBIDDEN` → 403
- `NOT_FOUND` → 404
- `INVALID_STATE_TRANSITION` → 400
- `CONFLICT` → 409
- `INTERNAL_ERROR` → 500

## 🐰 RabbitMQ Events

El servicio publica 5 tipos de eventos (si RabbitMQ está disponible):

1. **order.created** - Cuando se crea un pedido
2. **order.assigned** - Cuando un repartidor acepta
3. **order.status.changed** - Cada cambio de estado
4. **order.delivered** - Cuando se marca como entregado
5. **order.cancelled** - Cuando se cancela

### Fallback
Si RabbitMQ no está disponible o no está configurado, usa `MockPublisher` que logea los eventos localmente.

## 🔐 Autenticación & Autorización

Este microservicio **NO es responsable de autenticación**.

- El JWT viene en `Authorization: Bearer {token}`
- Solo **validamos la firma** usando `JWT_SECRET` del .env
- Extraemos `userId`, `role`, `sub` del token
- El Gateway o middleware central hace la autenticación real

### Roles Válidos
- `usuario` - Crea y ve sus propios pedidos
- `repartidor` - Acepta y actualiza estado
- `admin` - Acceso total

## 🐳 Docker (Próximamente)

```bash
# Build
docker build -t order-service:latest .

# Run
docker compose --env-file .env.docker up --build
```

## 📖 Próximos Pasos

- [ ] Integración con User Service (verificación de disponibilidad repartidor)
- [ ] Integración con Restaurant Service (validación de productos)
- [ ] Swagger UI en `/swagger/index.html`
- [ ] Métricas Prometheus
- [ ] Tracing distribuido
- [ ] Rate limiting por usuario

## 👨‍💻 Desarrollado por

- **Simon David Cruz Suazo**
- **Javier Leonardo Argoty Roa**

**PedidosCampus** - Plataforma de entregas para campus universitarios.
