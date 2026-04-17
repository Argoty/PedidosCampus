# Restaurant Service API

Microservicio de Restaurantes para la plataforma **PedidosCampus**. 

Gestiona restaurantes, menús de productos, validación de precios y está totalmente integrado con JWT para autenticación.

## Features ✨

- ✅ CRUD completo de Restaurantes
- ✅ CRUD completo de Productos (con soft-delete)
- ✅ Validación en lotes para integración con order-service
- ✅ Autenticación JWT con roles (admin)
- ✅ Paginación en listados
- ✅ Filtros por categoría, búsqueda y disponibilidad
- ✅ Documentación automática con Swagger/OpenAPI
- ✅ Tests unitarios completos (25 tests, 100% endpoints)
- ✅ Dockerizado y listo para producción

## Stack Tecnológico

| Componente | Tecnología |
|--|--|
| **Framework** | FastAPI 0.104+ |
| **ORM** | SQLAlchemy 2.0 (async) |
| **Base de Datos** | PostgreSQL (producción) / SQLite (desarrollo/tests) |
| **Validación** | Pydantic v2 |
| **Testing** | pytest + pytest-asyncio |
| **Autenticación** | JWT (python-jose) |
| **Documentación** | Swagger/OpenAPI (automática) |

## Estructura del Proyecto

```
.
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── restaurants.py    # Endpoints de restaurantes
│   │   │   │   └── products.py       # Endpoints de productos
│   │   │   └── router.py             # Router principal
│   │   └── dependencies.py           # Inyección de JWT
│   ├── core/
│   │   ├── config.py                 # Settings (env)
│   │   ├── database.py               # SQLAlchemy setup
│   │   └── security.py               # JWT + bcrypt
│   ├── models/
│   │   └── restaurant.py             # ORM models
│   ├── schemas/
│   │   └── restaurant.py             # Pydantic schemas
│   ├── repositories/
│   │   └── restaurant_repository.py  # Data access layer
│   ├── services/
│   │   └── restaurant_service.py     # Business logic
│   └── main.py                       # FastAPI app
├── tests/
│   ├── conftest.py                   # Fixtures pytest
│   ├── test_restaurants.py           # Tests endpoints restaurantes
│   └── test_products.py              # Tests endpoints productos
├── Dockerfile                        # Containerización
├── requirements.txt                  # Dependencies
├── .env                              # Environment variables
└── pytest.ini                        # Pytest config
```

## Quick Start 🚀

### 1. Instalación

```bash
# Clonar o entrar al directorio
cd microservices/restaurant-service

# Instalar dependencias
pip install -r requirements.txt

# (Opcional) Crear venv
python -m venv venv
source venv/bin/activate  # Linux/Mac
```

### 2. Configuración

Editar `.env`:

```dotenv
# Para desarrollo (SQLite)
DATABASE_URL=sqlite+aiosqlite:///:memory:

# Para PostgreSQL (producción)
# DATABASE_URL=postgresql+psycopg://user:pass@localhost/restaurant_db

SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
DEBUG=True
```

### 3. Ejecutar

```bash
# Desarrollo (con auto-reload)
uvicorn app.main:app --reload --port 8001

# Producción
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 4. Documentación

- **Swagger UI:** http://localhost:8001/docs
- **ReDoc:** http://localhost:8001/redoc
- **Health Check:** http://localhost:8001/health

## Tests ✅

```bash
# Correr todos los tests
pytest tests/ -v

# Tests específico
pytest tests/test_restaurants.py::TestRestaurantes::test_create_restaurante_admin -v

# Con cobertura
pytest tests/ --cov=app --cov-report=html

# Watch mode
pytest-watch tests/
```

**Status:** 25/25 tests passing ✅

## API Endpoints

### Restaurantes

```bash
# Crear restaurante (admin only)
POST /api/v1/restaurants
{
  "nombre": "El Buen Sabor",
  "descripcion": "Comida típica",
  "direccion": "Cra 5 # 10-20",
  "categoria": "Típica",
  "imagen_url": "https://..."
}

# Listar (público, con filtros)
GET /api/v1/restaurants?categoria=Típica&q=Buen&is_active=true&limit=50&offset=0

# Obtener detalle (con menú)
GET /api/v1/restaurants/{restaurante_id}?include_unavailable=false

# Actualizar (admin only)
PATCH /api/v1/restaurants/{restaurante_id}
{ "nombre": "Nuevo nombre" }

# Activar / Desactivar
POST /api/v1/restaurants/{restaurante_id}/activate
POST /api/v1/restaurants/{restaurante_id}/deactivate
```

### Productos

```bash
# Crear producto (admin only)
POST /api/v1/restaurants/{restaurante_id}/products
{
  "nombre": "Pizza Margarita",
  "descripcion": "Clásica con queso",
  "precio": "25.50",
  "disponible": true
}

# Listar por restaurante
GET /api/v1/restaurants/{restaurante_id}/products?disponible=true&limit=100

# Obtener producto
GET /api/v1/products/{producto_id}

# Actualizar
PATCH /api/v1/products/{producto_id}
{ "precio": "27.99" }

# Eliminar (soft delete)
DELETE /api/v1/products/{producto_id}

# Validación en lotes (para order-service)
POST /api/v1/products/validate-batch
{
  "items": [
    { "producto_id": "uuid...", "precio_unit": "25.50" },
    { "producto_id": "uuid...", "precio_unit": "15.00" }
  ]
}
```

## Autenticación 🔐

Todos los endpoints de **escritura** (POST, PATCH, DELETE) requieren **JWT con rol `admin`**:

```bash
# Header
Authorization: Bearer <token>

# Token example (incluye: sub, role, exp)
{
  "sub": "admin-user-123",
  "role": "admin",
  "exp": 1234567890
}
```

**Endpoints públicos (GET):**
- `GET /api/v1/restaurants`
- `GET /api/v1/restaurants/{id}`
- `GET /api/v1/products/{id}`
- `POST /api/v1/products/validate-batch`

## Docker 🐳

```bash
# Build
docker build -t restaurant-service:latest .

# Run
docker run -p 8001:8001 \
  -e DATABASE_URL=postgresql+psycopg://user:pass@db/restaurant_db \
  -e SECRET_KEY=your-secret \
  restaurant-service:latest

# Docker Compose (con PostgreSQL)
docker compose up --build
```

## Arquitectura

```
┌─────────────────────────────────────┐
│      FastAPI Application            │
│  (main.py + middleware + lifespan)  │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ┌──▼───────┐   ┌────▼──────┐
   │Restaurants│   │ Products  │
   │ Endpoints │   │ Endpoints │
   └──────┬────┘   └────┬──────┘
          │             │
    ┌─────▼─────────────▼────────┐
    │   Services (Business Logic) │
    │  - RestauranteService       │
    │  - ProductoService          │
    └─────┬─────────────┬─────────┘
          │             │
    ┌─────▼─────────────▼────────┐
    │  Repositories (Data Access) │
    │  - RestauranteRepository    │
    │  - ProductoRepository       │
    └─────┬─────────────┬─────────┘
          │             │
    ┌─────▼─────────────▼────────┐
    │  SQLAlchemy ORM Models     │
    │  - Restaurante             │
    │  - Producto                │
    └──────────┬─────────────────┘
               │
      ┌────────▼────────┐
      │  PostgreSQL DB  │
      └─────────────────┘
```

## Principios Aplicados

✅ **Clean Architecture:** Separación clara entre API, servicios, repositorios y modelos  
✅ **Async/Await:** Todas las operaciones de BD son asincrónicas  
✅ **Dependency Injection:** Manejo de sesiones, autenticación y config  
✅ **JWT Security:** Autenticación con roles en endpoints sensibles  
✅ **Pydantic Validation:** Validación exhaustiva de inputs  
✅ **Unit Testing:** Cobertura completa de endpoints y business logic  
✅ **Docker Ready:** Containerización con health checks  
✅ **OpenAPI Docs:** Documentación automática e interactiva  

## Próximos Pasos (Integración)

- [ ] Integración con API Gateway
- [ ] Event publishing a RabbitMQ (restaurante.created, product.updated, etc.)
- [ ] Consumer de eventos desde otros microservicios
- [ ] Caching de restaurantes/productos (Redis)
- [ ] Migrations automáticas (Alembic)
- [ ] Logging centralizado
- [ ] Monitoring (Prometheus)

## Referencias

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/20/)
- [Pydantic v2](https://docs.pydantic.dev/latest/)
- [pytest asyncio](https://pytest-asyncio.readthedocs.io/)

---

**Creado para:** PedidosCampus — Arquitectura de Microservicios Asíncronos  
**Ingeniería de Software · 5° Semestre**
