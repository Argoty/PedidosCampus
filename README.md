# PedidosCampus

Plataforma universitaria de pedidos construida con arquitectura de microservicios asincronos.

## 📋 Estado actual del repositorio

Fase de primera entrega academica:

- ✅ **Microservicio Auth**: NestJS + Prisma + PostgreSQL (operativo)
- ✅ **Microservicio User**: ASP.NET 8 + EF Core + PostgreSQL (operativo)
- ✅ **Docker Compose**: Stack local completo (auth-service + user-service)
- ✅ **Postman Collections**: Testing de todos los endpoints

## 🚀 Quick Start: Levantar Todo con Docker

### Opción A: Script Helper (recomendado)

```bash
./docker-setup.sh
# Menú interactivo con opciones:
# 1. Levantar servicios
# 2. Ver logs
# 3. Parar servicios
# etc.
```

### Opción B: Comandos Directos

```bash
# 1. Setup variables de entorno
cp .env.docker.example .env.docker

# 2. Levantar servicios (primera vez con build)
docker compose --env-file .env.docker up --build

# 3. En otra terminal, verificar
docker compose ps

# 4. Acceder a servicios
# - User Service: http://localhost:5000 (+ Swagger en /swagger)
# - Auth Service: http://localhost:3001
```

## 📚 Guías Completas

### 🐳 **Para Docker & Setup**
Consulta: **[DOCKER_SETUP.md](DOCKER_SETUP.md)**
- Setup paso a paso
- Troubleshooting
- Comandos útiles
- Workflows completos

### 🧪 **Para Testing de Endpoints**
Consulta: **[postman/README.md](postman/README.md)**
- Importar Postman collection
- Generar JWT mock token
- 4 testing workflows
- Ejemplo de requests

## 🎯 Microservicios

### Auth Service (`microservices/auth-service`)
- 🟢 **Status**: Operativo
- **Stack**: NestJS + Prisma + PostgreSQL
- **Endpoints**: Login, Register, Refresh, Logout, Profile
- **Autenticación**: JWT (access + refresh tokens)
- **Puerto**: 3001
- **BD**: `localhost:5433` (host), `auth-db:5432` (Docker)

### User Service (`microservices/user-service`)
- 🟢 **Status**: Operativo
- **Stack**: ASP.NET 8 + EF Core + PostgreSQL
- **Endpoints**: 15 endpoints (CRUD + admin + internal)
- **Features**: Profiles, Availability, Atomic Reserves
- **Swagger**: `http://localhost:5000/swagger`
- **Puerto**: 5000
- **BD**: `localhost:5434` (host), `user-db:5432` (Docker)

## 🔌 Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Docker Compose (localhost)                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐          ┌──────────────┐        │
│  │ Auth Service │          │ User Service │        │
│  │  (NestJS)    │          │  (ASP.NET 8) │        │
│  │   :3001      │          │   :5000      │        │
│  └──────┬───────┘          └──────┬───────┘        │
│         │                         │                 │
│  ┌──────▼───────┐          ┌──────▼───────┐        │
│  │  auth-db     │          │  user-db     │        │
│  │  PostgreSQL  │          │  PostgreSQL  │        │
│  │   :5433      │          │   :5434      │        │
│  └──────────────┘          └──────────────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘

Volumes (persistent):
- auth_postgres_data
- user_postgres_data
```

## 📡 Puertos Mapeados

| Servicio | Puerto Host | Puerto Container | Descripción |
|----------|-------------|-----------------|-------------|
| Auth API | 3001 | 3001 | NestJS API |
| Auth DB | 5433 | 5432 | PostgreSQL |
| User API | 5000 | 5000 | ASP.NET 8 API |
| User DB | 5434 | 5432 | PostgreSQL |

## 🧪 Testing

### Postman Collections

```bash
# User Service (15 endpoints)
postman/user-service.postman_collection.json

# Auth Service (5 endpoints)
postman/auth-service.postman_collection.json
```

**Para empezar:**
1. Importa la collection en Postman
2. Ejecuta "Generate JWT Mock Token" (carpeta Setup)
3. Prueba cualquier endpoint

### Tests Unitarios

```bash
# Auth Service
cd microservices/auth-service
npm test

# User Service
cd microservices/user-service
dotnet test
```

## 📝 Secretos y Variables de Entorno

⚠️ **NUNCA commiteés secretos reales**

```bash
# Archivos de ejemplo (OK comitear)
.env.docker.example
microservices/auth-service/.env.example

# Archivos reales (NO comitear, en .gitignore)
.env.docker
microservices/auth-service/.env
```

**Setup:**
```bash
cp .env.docker.example .env.docker
# Edita con valores reales (solo development):
nano .env.docker
```

## 🛠️ Troubleshooting

### Los servicios no leen mis cambios
```bash
# Rebuild without cache
docker compose build --no-cache
docker compose up
```

### Error: "address already in use"
```bash
# Ver qué ocupa el puerto (ej 5000)
lsof -i :5000

# Cambiar puerto en docker-compose.yml:
# ports:
#   - '5001:5000'  # Cambié 5000 a 5001
```

### BD corrupta o quiero limpiar
```bash
# Borrar todo (incluyendo volúmenes)
docker compose down -v

# Reconstruir desde cero
docker compose up --build
```

### Ver logs de un servicio
```bash
docker compose logs -f user-service
docker compose logs -f auth-service
```

## 📚 Documentación

- **DOCKER_SETUP.md** — Setup paso a paso, troubleshooting, comandos útiles
- **postman/README.md** — Testing, JWT, workflows, integration
- **microservices/user-service/API.md** — Especificación de 15 endpoints
- **microservices/auth-service/README.md** — Guía de auth-service
- **AGENTS.md** — Guía para asistentes/agentes de desarrollo

## 🚦 Próximos Pasos

- [ ] Integración API Gateway
- [ ] RabbitMQ eventos (profile.created, repartidor.availability.changed, etc.)
- [ ] Order Service
- [ ] Frontend

## 📖 Nota sobre AGENTS.md

`AGENTS.md` es documentación operativa para asistentes/agentes de desarrollo. Este `README.md` es para el equipo humano.
