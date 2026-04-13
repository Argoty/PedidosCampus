#!/usr/bin/env bash
# Lista de comandos para generar ERDs con la CLI de Liam (@liam-hq/cli) usando bunx
# Ejecutá cada línea desde la raíz del repo donde estén los archivos *-schema.prisma
# Requisitos: bun (bunx) instalado y acceso a la red para descargar la CLI.

set -euo pipefail

# Auth
bunx @liam-hq/cli erd build --input ../schemas/auth-schema.prisma --format prisma --output-dir auth-liam-erd

# Usuarios
bunx @liam-hq/cli erd build --input ../schemas/usuarios-schema.prisma --format prisma --output-dir usuarios-liam-erd

# Restaurantes
bunx @liam-hq/cli erd build --input ../schemas/restaurantes-schema.prisma --format prisma --output-dir restaurantes-liam-erd

# Pedidos
bunx @liam-hq/cli erd build --input ../schemas/pedidos-schema.prisma --format prisma --output-dir pedidos-liam-erd

# Notificaciones
bunx @liam-hq/cli erd build --input ../schemas/notificaciones-schema.prisma --format prisma --output-dir notificaciones-liam-erd

# Calificaciones
bunx @liam-hq/cli erd build --input ../schemas/calificaciones-schema.prisma --format prisma --output-dir calificaciones-liam-erd
