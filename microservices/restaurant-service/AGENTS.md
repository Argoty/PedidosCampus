# AGENTS.md

## Estado real del servicio
- `restaurant-service` es un FastAPI funcional con tests pasando.
- No hay `pyproject.toml`, `Makefile`, `alembic.ini`, workflows CI ni `opencode.json` dentro de este servicio.
- El `docker-compose.yml` de la raíz del monorepo SÍ levanta este servicio (puerto 8001).

## Fuentes de verdad (orden)
1. `app/main.py` (lifespan, healthcheck, middleware token, router global)
2. `app/core/config.py` + `app/core/database.py` (env obligatorias y engine async)
3. `app/api/v1/endpoints/restaurants.py` + `products.py` (contrato HTTP real)
4. `app/services/*_service.py` (lógica de negocio)
5. `app/schemas/restaurant.py` (DTOs)
6. `tests/conftest.py` + `tests/test_*.py` (comportamiento validado)
7. `Dockerfile` (runtime contenedor)

## Comandos reales
```bash
# Instalar deps
pip install -r requirements.txt

# Correr API en dev
uvicorn app.main:app --reload --port 8001

# Correr tests (con SERVICE_TOKEN seteado)
DATABASE_URL='sqlite+aiosqlite:///:memory:' SECRET_KEY='test-secret' SERVICE_TOKEN='test-service-token' pytest tests -q
```

## Variables obligatorias
- `DATABASE_URL`: URL de conexión async (ej: `postgresql+asyncpg://user:pass@host/db`)
- `SECRET_KEY`: Clave para JWT (definida en config, no usada actualmente para token)
- `SERVICE_TOKEN`: Token para middleware (env: `SERVICE_TOKEN`)

## Arquitectura
```
HTTP Request
    ↓
app/main.py (middleware x-service-token)
    ↓
api_router (/api/v1/router.py)
    ├── /restaurants → restaurants.py
    └── /restaurants → products.py
    ↓
endpoints → services → repositories → models (SQLAlchemy)
```

## Prefijos efectivos
- Router: `/api/v1`
- Restaurantes: `/api/v1/restaurants`
- Productos: `/api/v1/restaurants/products` + `/api/v1/restaurants/{restaurante_id}/products`

## Endpoints disponibles

### Restaurantes
| Método | Ruta | Auth |
|--------|-----|------|
| POST | /restaurants | admin |
| GET | /restaurants | public |
| GET | /restaurants/{id} | public |
| PATCH | /restaurants/{id} | admin |
| POST | /restaurants/{id}/activate | admin |
| POST | /restaurants/{id}/deactivate | admin |

### Productos
| Método | Ruta | Auth |
|--------|-----|------|
| POST | /restaurants/{id}/products | admin |
| GET | /restaurants/{id}/products | public |
| GET | /restaurants/products/{id} | public |
| PATCH | /restaurants/products/{id} | admin |
| DELETE | /restaurants/products/{id} | admin |
| POST | /restaurants/products/validate-batch | service |

### Health
| Método | Ruta | Auth |
|--------|-----|------|
| GET | /health | none |

## Gotchas de alto impacto
- **Startup**: `Base.metadata.create_all` ejecuta automáticamente (no alembic).
- **Middleware token**: `x-service-token` debe coincidir con `SERVICE_TOKEN` env o retorna 403.
- **JWT rol**: Dependencia `require_admin_role` verificaclaims rol. Si no es `admin`, retorna 403.
- **Soft-delete**: DELETE en productos marca `disponible=false`, no elimina fila.
- **Filtro activo**: `GET /restaurants` filtra `is_active=True` por defecto.
- **Prisma esquemas**: `*.prisma` existen pero no se usan en runtime Python.

## Testing quirks
- Tests usan SQLite en memoria (`DATABASE_URL='sqlite+aiosqlite:///:memory:'`).
- `SECRET_KEY` debe estar presente aunque no se use (config la requiere).
- Override inline de vars evita dependencia del `.env` local.

## Dependencias clave
- `fastapi`, `sqlalchemy`, `asyncpg`, `pydantic`, `python-jose`, `aiosqlite`