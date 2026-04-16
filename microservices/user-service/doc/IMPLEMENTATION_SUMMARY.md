# User Service — Implementation Summary

## ✅ Completado

### 1. Estructura base (.NET 8 + EF Core)
- ✅ **UserProfile Model** — Entidad con campos: id, userId, tipo, nombre, telefono, direccion, disponible, isActive, reservedUntil, timestamps
- ✅ **UserServiceDbContext** — DbContext configurado con índices, validaciones y mappeos EF Core
- ✅ **Migraciones** — Migración inicial que crea tabla `usuario_perfiles` con índices correctos

### 2. Endpoints (13 totales)
Todos implementados en `Controllers/ProfilesController.cs`:

**Públicos/Autenticados:**
- ✅ POST /api/profiles — Crear perfil
- ✅ GET /api/profiles/me — Obtener mi perfil
- ✅ PATCH /api/profiles/me — Actualizar mi perfil
- ✅ POST /api/profiles/me/availability — Cambiar disponibilidad (repartidor)
- ✅ GET /api/profiles/me/availability — Consultar mi disponibilidad

**Admin:**
- ✅ GET /api/profiles — Listar perfiles (con filtros)
- ✅ GET /api/profiles/{id} — Obtener perfil por ID
- ✅ PATCH /api/profiles/{id} — Actualizar perfil (admin)
- ✅ DELETE /api/profiles/{id} — Eliminar perfil
- ✅ POST /api/profiles/{id}/deactivate — Desactivar
- ✅ POST /api/profiles/{id}/activate — Activar

**Internal (Gateway-only, header X-Client: gateway):**
- ✅ GET /api/profiles/delivery — Listar repartidores disponibles
- ✅ GET /api/profiles/search — Búsqueda avanzada
- ✅ POST /api/profiles/{id}/reserve — Reserva atómica
- ✅ POST /api/profiles/{id}/release — Liberar reserva

### 3. Servicios de negocio
- ✅ **ProfileService** — Interfaz + implementación con métodos para todas las operaciones
- ✅ **Lógica de reserva atómica** — Previene race conditions en asignación de repartidores

### 4. DTOs (Data Transfer Objects)
- ✅ CreateProfileRequest, UpdateProfileRequest, AvailabilityRequest, ReserveRequest
- ✅ ErrorResponse, UserProfileResponse, ReserveResponse
- ✅ PaginatedResponse[T], AvailabilityResponse
- ✅ Validaciones con Data Annotations

### 5. Pruebas unitarias
- ✅ **ProfileServiceTests** — 14 casos de prueba (happy path, errores, atomicidad)
- ✅ Usa InMemoryDatabase (sin dependencia de PostgreSQL)
- ✅ Mock de logger

### 6. Configuración y despliegue
- ✅ **Program.cs** — Registra DbContext, servicios, CORS, Swagger
- ✅ **appsettings.json** — Cadena de conexión PostgreSQL
- ✅ **appsettings.Development.json** — Logging DEBUG
- ✅ **Dockerfile** — Multi-stage build, runtime aspnet:8.0
- ✅ **docker-compose.yml** — Actualizado con user-db + user-service
- ✅ **Swagger/OpenAPI** — Habilitado en desarrollo

### 7. Documentación
- ✅ API.md — Actualizado con todos los endpoints, DTOs, eventos RabbitMQ
- ✅ usuarios-schema.prisma — Actualizado con reservedUntil e índices
- ✅ README.md (user-service) — Setup, comandos, estructura
- ✅ UserService.http — 16 ejemplos de llamadas REST
- ✅ AGENTS.md — Actualizado con info de user-service

---

## ⚠️ TODOs para siguiente entrega

### 1. Autenticación JWT (bloqueante para producción)
```csharp
// En ProfilesController, descomentar y completar:
var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? string.Empty);
// Validar rol del usuario (usuario, repartidor, admin)
```
- Requiere: middleware de validación JWT
- Depende de: auth-service emitiendo tokens válidos

### 2. Validación de acceso "internal"
```csharp
// En endpoints con [HttpGet("delivery")], [HttpPost("{id}/reserve")], etc.:
// Validar header X-Client: gateway
if (Request.Headers["X-Client"] != "gateway")
    return Forbid();
```

### 3. Integración con RabbitMQ
- Publicar eventos cuando:
  - Perfil creado: `profile.created`
  - Perfil actualizado: `profile.updated`
  - Disponibilidad cambiada: `repartidor.availability.changed`
  - Perfil reservado: `profile.reserved`
  - Perfil liberado: `profile.released`
- Usar: MassTransit o RabbitMQ.Client

### 4. Pruebas de integración
- Contra PostgreSQL real (no InMemory)
- Test de endpoints HTTP (HttpClient)
- Test de concurrencia en reservas

### 5. Manejo de errores mejorado
- Middleware de GlobalExceptionHandler
- Logs estructurados (Serilog)
- Tracing distribuido (OpenTelemetry)

---

## 🚀 Comandos rápidos

### Local (sin Docker)
```bash
cd microservices/user-service

# Restaurar y ejecutar
dotnet restore
dotnet ef database update
dotnet watch run

# Probar
curl http://localhost:5000/swagger
```

### Docker
```bash
# Desde raiz del repo
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build

# User Service estará en http://localhost:5000
# PostgreSQL en localhost:5434 (user_db)
```

### Tests
```bash
dotnet test
dotnet test /p:CollectCoverage=true
```

---

## 📊 Stack resumido

| Componente | Tech | Versión |
|-----------|------|---------|
| Framework | ASP.NET | 8.0 |
| ORM | Entity Framework Core | 8.0.0 |
| Provider BD | Npgsql | 8.0.0 |
| Testing | xUnit + Moq | latest |
| API Docs | Swagger | 6.6.2 |
| Container | Docker | — |

---

## 🔗 Referencias

- **API.md** — Contrato completo de endpoints
- **usuarios-schema.prisma** — Esquema de referencia (no se usa, solo para documentación)
- **AGENTS.md** — Instrucciones para agentes de desarrollo
- **README.md** — Setup y uso del microservicio

---

## ❓ Preguntas frecuentes

**¿Por qué userId no se expone en respuestas HTTP?**
- userId es referencia a Auth Service. Exponerlo sería leak de IDs internos. Usamos profileId en su lugar.

**¿Cómo funciona la reserva atómica?**
- Se actualiza reservedUntil = now + ttlSeconds solo si disponible=true Y reservedUntil <= now.
- Si falla (otra transacción la reservó primero), devuelve 409 Conflict.

**¿Por qué header X-Client: gateway?**
- En producción, el API Gateway validaría JWT y role. Para desarrollo, simulamos acceso "internal" con este header.

**¿Cuándo se activará la autenticación JWT?**
- Cuando auth-service esté funcionando y emita tokens válidos. Actualmente hay TODOs en el código.

---

Generado: 2026-04-13  
Equipo: PedidosCampus
