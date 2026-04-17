# AGENTS.md

## Estado real del servicio (verificado en código)
- `restaurant-service` es un FastAPI funcional (no placeholder) con tests pasando.
- No hay `pyproject.toml`, `Makefile`, `alembic.ini`, workflows CI ni `opencode.json` dentro de este servicio.
- El `docker-compose.yml` de la raíz del monorepo **no** levanta este servicio actualmente.

## Fuentes de verdad (orden sugerido)
1. `app/main.py` (lifespan, healthcheck, router global)
2. `app/core/config.py` + `app/core/database.py` (env obligatorias y engine async)
3. `app/api/v1/endpoints/*.py` (contrato HTTP real)
4. `tests/conftest.py` + `tests/test_*.py` (comportamiento validado)
5. `Dockerfile` (runtime real en contenedor)

## Comandos reales (desde `microservices/restaurant-service`)
- Instalar deps: `pip install -r requirements.txt`
- Correr API en dev: `uvicorn app.main:app --reload --port 8001`
- Correr tests (aislado de `.env` local):
  - Suite completa: `DATABASE_URL='sqlite+aiosqlite:///:memory:' SECRET_KEY='test-secret' pytest tests -q`
  - Un test puntual: `DATABASE_URL='sqlite+aiosqlite:///:memory:' SECRET_KEY='test-secret' pytest tests/test_restaurants.py::TestRestaurantes::test_list_restaurantes -q`

## Variables y orden importante
- `DATABASE_URL` y `SECRET_KEY` son obligatorias (`app/core/config.py`). Si faltan, la app falla al importar settings.
- `get_settings()` usa `.env` por defecto, pero en tests conviene sobreescribir variables inline para evitar acoplarse al entorno local.

## Arquitectura y entrypoints que importan
- Entrada HTTP: `app/main.py` → `app/api/v1/router.py` → endpoints en `app/api/v1/endpoints/`.
- Capas reales: endpoint → service (`app/services/restaurant_service.py`) → repository (`app/repositories/restaurant_repository.py`) → modelos SQLAlchemy (`app/models/restaurant.py`).
- Prefijo API efectivo: `/api/v1`.

## Gotchas de alto impacto
- En startup se ejecuta `Base.metadata.create_all` (no hay migraciones Alembic activas).
- `restaurantes-schema.prisma` existe, pero el runtime Python no lo usa para esquema ni migraciones.
- `DELETE /api/v1/products/{id}` es soft delete: pone `disponible=false`.
- `GET /api/v1/restaurants` filtra por `is_active=True` por defecto (si no se pasa query param).
- Endpoints de escritura dependen de rol JWT exacto `admin`; cualquier otro rol devuelve `403`.

## Testing quirks
- Los tests reemplazan `get_db` con SQLite en memoria (`tests/conftest.py`), no usan PostgreSQL.
- Si tu `.env` apunta a un driver PostgreSQL no instalado, los tests pueden romper antes de arrancar; por eso usar override inline de `DATABASE_URL`.
