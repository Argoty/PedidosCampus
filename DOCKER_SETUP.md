# 🚀 Guía Paso a Paso — Levantar PedidosCampus con Docker Compose

Esta guía te muestra cómo levantar el proyecto **completo** (auth-service + user-service) localmente con Docker Compose.

## 📋 Requisitos Previos

Verifica que tenés instalado:

```bash
# Verificar Docker
docker --version
# Esperado: Docker version 20.10+ (cualquier versión moderna)

# Verificar Docker Compose
docker compose version
# Esperado: Docker Compose version 2.0+
```

Si no tenés Docker, descargalo desde: https://www.docker.com/products/docker-desktop

## 📁 Estructura del Proyecto

```
PedidosCampus/
├── docker-compose.yml          ← Definición de servicios
├── .env.docker.example         ← Template de secretos
├── microservices/
│   ├── auth-service/           ← NestJS + Prisma + PostgreSQL
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── ...
│   └── user-service/           ← ASP.NET 8 + EF Core + PostgreSQL
│       ├── Dockerfile
│       ├── appsettings.json
│       └── ...
└── postman/
    └── user-service.postman_collection.json
```

## 🔧 Paso 1: Configurar Variables de Entorno

### 1.1 Crear archivo `.env.docker` para secrets

Docker Compose leerá los secretos de este archivo (NO será committeado).

```bash
# Desde la raíz del proyecto
cp .env.docker.example .env.docker
```

Ahora edita `.env.docker` con valores reales (o usa los defaults de desarrollo):

```bash
nano .env.docker
# O con tu editor favorito
code .env.docker
```

**Contenido recomendado para DESARROLLO LOCAL:**

```env
# Auth Service Database
AUTH_DB_PASSWORD=dev_auth_password_123

# JWT Secrets (solo para dev, cambiar en producción)
ACCESS_TOKEN_SECRET=dev_access_token_secret_123_very_secret
REFRESH_TOKEN_SECRET=dev_refresh_token_secret_123_very_secret

# User Service (usa defaults con fallback)
# USER_DB_PASSWORD=user_password (opcional, hay fallback)
```

**⚠️ IMPORTANTE**: Este archivo NO se commitea (está en `.gitignore`).

### 1.2 (Opcional) Configurar auth-service `.env` local

Si quieres correr auth-service sin Docker:

```bash
cp microservices/auth-service/.env.example microservices/auth-service/.env
```

Edita si necesitas cambiar valores (Docker Compose ignora este archivo).

## 🐳 Paso 2: Levantar los Servicios con Docker Compose

### 2.1 Build + Start (First Time)

```bash
# Desde la raíz del proyecto
docker compose --env-file .env.docker up --build
```

**¿Qué hace este comando?**
- `--env-file .env.docker` → Lee variables de entorno del archivo
- `up` → Levanta todos los servicios
- `--build` → Compila las imágenes Docker (solo necesario first time o después de cambios)

**Esperado (primeras líneas):**
```
Creating network "pedidoscampus_default" with default driver
Creating pedidoscampus-auth-db    ... done
Creating pedidoscampus-user-db    ... done
Creating pedidoscampus-auth-service    ... done
Creating pedidoscampus-user-service    ... done
```

**Espera ~30-60 segundos mientras:**
- Descarga imágenes base (postgres:16-alpine, node:20, dotnet:8)
- Compila auth-service (NestJS)
- Compila user-service (ASP.NET)
- Aplica migraciones en las BDs

### 2.2 Verificar que todos los servicios estén "healthy"

En **otra terminal**, verifica:

```bash
docker compose ps
```

**Esperado:**
```
NAME                         COMMAND                  SERVICE      STATUS         PORTS
pedidoscampus-auth-db        "docker-entrypoint..."   auth-db      Up (healthy)   0.0.0.0:5433->5432/tcp
pedidoscampus-auth-service   "docker-entrypoint..."   auth-service Up             0.0.0.0:3001->3001/tcp
pedidoscampus-user-db        "docker-entrypoint..."   user-db      Up (healthy)   0.0.0.0:5434->5432/tcp
pedidoscampus-user-service   "docker-entrypoint..."   user-service Up             0.0.0.0:5000->5000/tcp
```

Todos deben estar en estado `Up` o `Up (healthy)`.

### 2.3 Ver logs de servicios

Para ver qué está pasando:

```bash
# Ver logs de todos los servicios
docker compose --env-file .env.docker logs -f

# Ver logs de un servicio específico
docker compose --env-file .env.docker logs -f user-service
docker compose --env-file .env.docker logs -f auth-service
```

**Logs esperados del user-service:**
```
pedidoscampus-user-service | info: Microsoft.Hosting.Lifetime[14]
pedidoscampus-user-service |       Now listening on: http://[::]:5000
pedidoscampus-user-service | info: Microsoft.Hosting.Lifetime[0]
pedidoscampus-user-service |       Application started. Press Ctrl+C to shut down.
```

## ✅ Paso 3: Verificar que los Servicios Funcionan

### 3.1 Test: User Service

```bash
# GET /swagger (Swagger UI)
curl http://localhost:5000/swagger/ui/index.html

# O en el navegador:
# http://localhost:5000/swagger/ui/index.html
```

**Esperado:** Ves el UI de Swagger con todos los 15 endpoints documentados.

### 3.2 Test: Auth Service

```bash
# Health check
curl http://localhost:3001/health

# O test login (sin credenciales válidas):
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Esperado:** 200 OK o 401 Unauthorized (es normal, no hay usuario registrado).

### 3.3 Test: Bases de Datos

```bash
# Conectar a auth-db
psql postgresql://auth_user:dev_auth_password_123@localhost:5433/auth_db

# Conectar a user-db
psql postgresql://user_user:user_password@localhost:5434/user_db

# Listar tablas (en psql):
\dt
```

**Esperado:** Ver tablas creadas por las migraciones.

## 🧪 Paso 4: Probar Endpoints con Postman

### 4.1 Importar Collection

1. Abre **Postman**
2. `File` → `Import`
3. Selecciona: `postman/user-service.postman_collection.json`

### 4.2 Generar JWT Mock Token

1. En Postman, ve a carpeta **"1️⃣ Setup & Variables"**
2. Click en request **"Generate JWT Mock Token"**
3. Click **"Send"**
4. El token se genera automáticamente y se guarda en variable `jwt_token`

### 4.3 Probar Endpoint

1. Ve a carpeta **"2️⃣ User Endpoints"**
2. Click en **"GET /me - Get My Profile"**
3. Click **"Send"**

**Esperado:**
```json
{
  "profileId": "...",
  "tipo": "usuario",
  "nombre": "...",
  ...
}
```

O si no existe perfil aún:
```json
{
  "code": "NOT_FOUND",
  "message": "Perfil no encontrado"
}
```

## 🔄 Paso 5: Workflows Completos

### 5.1 Crear un Perfil + Verificar

```bash
# 1. Generar JWT (si no lo hiciste en Postman)
# Ver postman/README.md para instrucciones

# 2. Crear perfil
curl -X POST http://localhost:5000/api/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "tipo": "usuario",
    "nombre": "Juan Pérez",
    "telefono": "+34912345678",
    "direccion": "Calle Principal 123"
  }'

# Respuesta esperada: 201 Created
# {
#   "profileId": "550e8400-...",
#   "tipo": "usuario",
#   "nombre": "Juan Pérez",
#   ...
# }

# 3. Verificar que existe
curl http://localhost:5000/api/profiles/me \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 5.2 Listar Perfiles (Admin)

```bash
# Este endpoint requiere role "admin"
# Genera JWT con role=admin o usa Postman

curl "http://localhost:5000/api/profiles?tipo=usuario&limit=10" \
  -H "Authorization: Bearer $JWT_ADMIN_TOKEN"
```

## 🛑 Paso 6: Parar los Servicios

### 6.1 Graceful Shutdown

```bash
# En la terminal donde corre docker compose, presiona: Ctrl+C

# O desde otra terminal:
docker compose --env-file .env.docker down
```

**Esperado:**
```
Stopping pedidoscampus-auth-service   ... done
Stopping pedidoscampus-user-service   ... done
Stopping pedidoscampus-auth-db        ... done
Stopping pedidoscampus-user-db        ... done
Removing pedidoscampus-auth-service   ... done
Removing pedidoscampus-user-service   ... done
Removing pedidoscampus-auth-db        ... done
Removing pedidoscampus-user-db        ... done
Removing network pedidoscampus_default
```

**⚠️ Nota:** Los volúmenes de BD persisten (ver `docker volume ls`). Esto es BUENO para desarrollo — tus datos se mantienen.

### 6.2 (Opcional) Limpiar Todo

```bash
# Borra contenedores, redes, y VOLÚMENES (cuidado: pierdes datos)
docker compose --env-file .env.docker down -v

# Solo después de esto, la BD se reinicializa en el próximo `up`
```

## 📊 Puertos Mapeados

| Servicio | Container | Host | Descripción |
|----------|-----------|------|-------------|
| auth-db | 5432 | 5433 | PostgreSQL para auth |
| auth-service | 3001 | 3001 | NestJS API |
| user-db | 5432 | 5434 | PostgreSQL para user |
| user-service | 5000 | 5000 | ASP.NET API + Swagger |

**Accesos locales:**
- Auth Service: `http://localhost:3001`
- User Service: `http://localhost:5000`
- User Service Swagger: `http://localhost:5000/swagger/ui/index.html`
- Auth DB: `localhost:5433` (psql)
- User DB: `localhost:5434` (psql)

## 🐛 Troubleshooting

### "Error: can't find docker compose"
```bash
# Solución: Instalá Docker Desktop (incluye compose)
# O instala docker-compose manualmente:
# https://docs.docker.com/compose/install/
```

### "Error: AUTH_DB_PASSWORD is not set"
```bash
# Solución: Creaste .env.docker?
cp .env.docker.example .env.docker

# Verifica que contiene valores (no vacío)
cat .env.docker
```

### "Error: bind: address already in use"
```bash
# Significa que el puerto ya está ocupado (otro container o proceso)
# Opciones:

# 1. Ver qué ocupa el puerto (ejemplo puerto 5000)
lsof -i :5000
# O en macOS:
netstat -an | grep 5000

# 2. Parar el proceso que lo ocupa
# O cambiar puerto en docker-compose.yml:
# ports:
#   - '5001:5000'  (cambié host port de 5000 a 5001)

# 3. Reintentar
docker compose --env-file .env.docker up --build
```

### "Error: service not healthy"
```bash
# Espera más tiempo (primeras migraciones pueden tardar)
docker compose --env-file .env.docker logs -f

# Busca errores en los logs. Común:
# - Credenciales BD incorrectas
# - Puertos ya en uso
# - Insuficiente recursos (RAM/CPU)
```

### "Error: psql connection refused"
```bash
# Las BDs no terminaron de inicializarse
# Espera 30-60 segundos más:
docker compose ps

# Busca que diga "(healthy)" en la columna STATUS
```

### "Borrón BD completamente y empezar fresh"
```bash
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up --build
```

## 🚦 Flujo Completo Step by Step (Quick Version)

```bash
# 1. Setup
cp .env.docker.example .env.docker
# Edita .env.docker con valores (o deja defaults)

# 2. Up
docker compose --env-file .env.docker up --build

# 3. Verificar en otra terminal
docker compose ps

# 4. Test (en otra terminal)
curl http://localhost:5000/swagger/ui/index.html
curl http://localhost:3001/health

# 5. Usar Postman
# - Importa postman/user-service.postman_collection.json
# - Genera JWT
# - Prueba endpoints

# 6. Down
docker compose --env-file .env.docker down
```

## 📚 Comandos Útiles

```bash
# Ver estado de servicios
docker compose ps

# Ver logs en tiempo real
docker compose --env-file .env.docker logs -f

# Ver logs de un servicio
docker compose --env-file .env.docker logs -f user-service

# Ejecutar comando dentro de contenedor
docker compose exec user-service ls -la

# Conectar a BD
docker compose exec user-db psql -U user_user -d user_db

# Rebuild una sola imagen
docker compose build user-service

# Reiniciar un servicio
docker compose restart user-service

# Ver variables de entorno de un servicio
docker compose exec user-service env | grep CONNECTION
```

## 🎯 Resumen

| Paso | Comando | Duración |
|------|---------|----------|
| 1. Config | `cp .env.docker.example .env.docker` | 1 min |
| 2. Build + Start | `docker compose --env-file .env.docker up --build` | 2-5 min |
| 3. Verificar | `docker compose ps` + `curl` | 1 min |
| 4. Postman | Importar + generar JWT | 2 min |
| 5. Test | Probar endpoints | 5-10 min |
| 6. Stop | `Ctrl+C` o `docker compose down` | 30 seg |

**Total: ~15-30 minutos la primera vez**

---

**¿Encontraste problemas?** 
- Revisa logs: `docker compose --env-file .env.docker logs -f`
- Verifica puertos: `docker compose ps`
- Limpia y reinicia: `docker compose --env-file .env.docker down -v && docker compose --env-file .env.docker up --build`

**¿Querés aprender más?**
- Docker Compose docs: https://docs.docker.com/compose/
- Dockerfile reference: https://docs.docker.com/engine/reference/builder/
- PostgreSQL Docker: https://hub.docker.com/_/postgres
