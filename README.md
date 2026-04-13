# PedidosCampus

Plataforma universitaria de pedidos construida con arquitectura de microservicios asincronos.

## Estado actual del repositorio

Este repositorio esta en fase de primera entrega academica. Por ahora incluye:

- Documentacion funcional y diagramas en `docs/`
- Esquemas Prisma por microservicio en la raiz (`*-schema.prisma`)
- Microservicio implementado: `Auth` en `microservices/auth-service`

## Microservicio disponible hoy

### Auth (`microservices/auth-service`)

Incluye:

- Registro, login, refresh, logout y perfil
- Roles `usuario`, `repartidor`, `admin`
- JWT access token (15 min) + refresh token (7 dias)
- Prisma + PostgreSQL
- Dockerfile y pruebas unitarias basicas

## Levantar en local con Docker

Desde la raiz del repo:

1. Copiar variables locales de docker:
   - `cp .env.docker.example .env.docker`
2. Levantar servicios:
   - `docker compose --env-file .env.docker up --build`

Servicios expuestos:

- Auth API: `http://localhost:3001`
- PostgreSQL de Auth: `localhost:5433`

## Pruebas de endpoints

Importa en Postman:

- `postman/auth-service.postman_collection.json`

## Nota sobre AGENTS.md

`AGENTS.md` es una guia operativa para asistentes/agentes de desarrollo dentro de este repo. Este `README.md` es la guia general para personas del equipo.
