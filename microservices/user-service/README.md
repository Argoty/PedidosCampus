# User Service

Microservicio de perfiles de usuario y repartidor para PedidosCampus. Gestiona la creación, actualización, búsqueda y disponibilidad de perfiles de usuarios regulares y repartidores.

## Tech Stack

- **Framework:** ASP.NET 8 (C#)
- **ORM:** Entity Framework Core 8
- **Base de Datos:** PostgreSQL
- **Documentación:** Swagger/OpenAPI

## Requisitos previos

- .NET 8 SDK
- PostgreSQL 12+ corriendo localmente o en Docker
- Postman (opcional, para pruebas de endpoints)

## Setup local (sin Docker)

### 1. Clonar y navegar al directorio

```bash
cd microservices/user-service
```

### 2. Restaurar dependencias

```bash
dotnet restore
```

### 3. Configurar la base de datos

Asegúrate de que PostgreSQL está corriendo. La cadena de conexión por defecto es:

```
Host=localhost;Port=5432;Database=user_db;Username=user_user;Password=user_password
```

Puedes cambiarla en `appsettings.json` o `appsettings.Development.json`.

### 4. Aplicar migraciones

```bash
dotnet ef database update
```

Esta comando crea la tabla `usuario_perfiles` y los índices necesarios.

### 5. Ejecutar en desarrollo

```bash
dotnet watch run
```

O simplemente:

```bash
dotnet run
```

El servicio estará disponible en `http://localhost:5000` (o el puerto configurado).

### 6. Acceder a Swagger

Abre en el navegador: `http://localhost:5000/swagger`

## Endpoints principales

Consulta `API.md` para la especificación completa de todos los endpoints.

### Ejemplos rápidos

**Crear un nuevo perfil:**

```bash
curl -X POST http://localhost:5000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "usuario",
    "nombre": "Juan Pérez",
    "telefono": "+57 300 1234567",
    "direccion": "Cra 5 # 10-20"
  }'
```

**Obtener mi perfil:**

```bash
curl -X GET http://localhost:5000/api/profiles/me \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

**Cambiar disponibilidad (repartidor):**

```bash
curl -X POST http://localhost:5000/api/profiles/me/availability \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -d '{"disponible": true}'
```

**Listar repartidores disponibles (solo a través del Gateway):**

```bash
curl -X GET "http://localhost:5000/api/profiles/delivery?onlyAvailable=true" \
  -H "X-Client: gateway"
```

## Pruebas

### Unitarias

```bash
# Ejecutar todas las pruebas
dotnet test

# Con cobertura
dotnet test /p:CollectCoverage=true /p:CoverageFormat=lcov
```

## Estructura del proyecto

```
user-service/
├── Controllers/           # Controladores (endpoints HTTP)
│   └── ProfilesController.cs
├── Models/               # Entidades de dominio
│   └── UserProfile.cs
├── DTOs/                 # Data Transfer Objects
│   └── ProfileDtos.cs
├── Services/             # Lógica de negocio
│   └── ProfileService.cs
├── Data/                 # Acceso a datos (EF Core)
│   └── UserServiceDbContext.cs
├── Migrations/           # Migraciones de EF Core
├── API.md                # Especificación de endpoints
├── UserService.csproj    # Proyecto .NET
├── Program.cs            # Configuración principal
├── appsettings.json      # Configuración por defecto
└── appsettings.Development.json  # Configuración de desarrollo
```

## Variables de entorno

Puedes usar variables de entorno para configurar la base de datos y otros parámetros:

```bash
export USUARIOS_DATABASE_URL="Host=localhost;Port=5432;Database=user_db;Username=user_user;Password=user_password"
export ASPNETCORE_ENVIRONMENT=Development
```

## Migraciones

Si necesitas crear una nueva migración después de cambiar los modelos:

```bash
# Crear una migración
dotnet ef migrations add NombreMigracion

# Aplicar la migración
dotnet ef database update
```

## Logs

- En **desarrollo:** Nivel DEBUG
- En **producción:** Nivel Information

Configurable en `appsettings.json` bajo `Logging.LogLevel`.

## Notas importantes

- **UserId nunca se expone** en respuestas HTTP (siempre usamos el `Id` del perfil).
- **Endpoints internos** (ej: `/profiles/delivery`, `/reserve`, `/release`) esperan el header `X-Client: gateway` para simular acceso a través del API Gateway.
- **Reservas atómicas** de repartidores usan `ReservedUntil` para evitar race conditions.
- EF Core está configurado para usar **NpgSQL** como provider de PostgreSQL.

## Próximos pasos

- [ ] Implementar autenticación JWT (integración con Auth Service)
- [ ] Agregar validación de claims de rol (admin, usuario, repartidor)
- [ ] Integración con RabbitMQ para eventos (perfil.creado, disponibilidad.cambiada, etc.)
- [ ] Pruebas unitarias completas
- [ ] Dockerfile para containerización
- [ ] Documentación OpenAPI (Swagger) mejorada

## Contacto

Equipo PedidosCampus - equipo@pedidoscampus.local

