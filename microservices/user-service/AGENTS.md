# AGENTS.md — User Service

## Stack
ASP.NET 8 + EF Core 8 + PostgreSQL 16 + xUnit + Swagger/OpenAPI.

## Entrypoint
`src/Program.cs` → DI, migraciones, controllers.

## Archivos Principales
- `src/Controllers/ProfilesController.cs` — 15 endpoints HTTP
- `src/Services/ProfileService.cs` — Lógica de negocio
- `src/Data/UserServiceDbContext.cs` — EF Core DbContext
- `src/Models/UserProfile.cs` — Entidad de dominio
- `src/DTOs/ProfileDTOs.cs` — DTOs request/response
- `Tests/ProfileServiceTests.cs` — Tests unitarios xUnit

## Comandos Verificados

### Local
```bash
cd microservices/user-service
dotnet restore
dotnet watch run   # Live reload
dotnet run         # Normal
dotnet test       # Tests (InMemoryDatabase)
dotnet ef database update
dotnet ef migrations add Nombre
```

### Docker
```bash
docker compose --env-file .env.docker up --build
docker compose --env-file .env.docker logs -f user-service
```

**Puertos locales:** 5000 (API), 5432 (PostgreSQL).  
**Puertos Docker:** 5000 (API), 5434 (PostgreSQL).

## Arquitectura Capas
- Controller → HTTP routing, JWT extraction (`User.FindFirst("sub")`)
- Service → Lógica de negocio, persistencia
- Data → EF Core DbContext, queries
- Models → Entidad de dominio (UserId no exponer en responses)
- DTOs → Contratos request/response

## Comportamientos Clave
1. JWT extrae userId desde claim "sub"
2. Un perfil por usuario (InvalidOperationException si existe)
3. Tipos válidos: "usuario", "repartidor"
4. Soft delete: flag IsActive
5. Reserva atómica: ReservedUntil para evitar race conditions
6. Endpoints internos requieren header X-Client: gateway

## Database

### Connection String
Priordad: appsettings.json → env var USUARIOS_DATABASE_URL → hardcoded default.

### Migraciones
Almacenadas en `src/Migrations/`. Auto-generadas por EF Core.
Desarrollo: auto-aplica en startup. Producción: aplicar manualmente.

## Testing
Usa InMemoryDatabase. Cada test obtiene DB única vía Guid.
```bash
dotnet test
```

## Gotchas
1. JWT malformado → "No subject claim in token"
2. Perfil ya existe → InvalidOperationException
3. Migraciones no aplicadas → startup falla
4. appsettings.Development.json solo carga con ASPNETCORE_ENVIRONMENT=Development
5. InMemoryDatabase ≠ PostgreSQL real
6. UserId nunca exponer en responses DTO

## Convenciones
- Rutas: /api/profiles/*
- Métodos async: sufijo *Async, retorno Task<T>
- Errores: Controller captura, retorna HTTP status + ErrorResponse
- Logging: Structured con placeholders {Property}

## Scope Actual

### Implementado
- ✅ CRUD perfiles (usuario, repartidor)
- ✅ Disponibilidad repartidor
- ✅ Reserva atómica (ReservedUntil)
- ✅ Soft delete (IsActive)
- ✅ JWT extraction
- ✅ Swagger /swagger

### Pendiente
- ❌ RabbitMQ eventos
- ❌ API Gateway real
- ❌ Role-based authorization (solo decoradores)
- ❌ Multi-tenant

## Errores HTTP
200, 201, 204, 400, 401, 403, 404, 409, 500

---

**Última actualización:** Mayo 2026