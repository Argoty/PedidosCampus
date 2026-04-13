#!/usr/bin/env bash
# Lista de comandos para generar ERDs con la CLI de Liam (@liam-hq/cli) usando bunx
# Ejecutá cada línea desde la raíz del repo donde estén los archivos *-schema.prisma
# Requisitos: bun (bunx) instalado y acceso a la red para descargar la CLI.

set -euo pipefail

echo "Comandos listos. Ejecutá uno por uno o pegá el bloque en tu terminal."

# Auth
bunx @liam-hq/cli erd build --input auth-schema.prisma --format prisma --output-dir auth-liam-erd

# Usuarios
bunx @liam-hq/cli erd build --input usuarios-schema.prisma --format prisma --output-dir usuarios-liam-erd

# Restaurantes
bunx @liam-hq/cli erd build --input restaurantes-schema.prisma --format prisma --output-dir restaurantes-liam-erd

# Pedidos
bunx @liam-hq/cli erd build --input pedidos-schema.prisma --format prisma --output-dir pedidos-liam-erd

# Notificaciones
bunx @liam-hq/cli erd build --input notificaciones-schema.prisma --format prisma --output-dir notificaciones-liam-erd

# Calificaciones
bunx @liam-hq/cli erd build --input calificaciones-schema.prisma --format prisma --output-dir calificaciones-liam-erd

echo "Hecho: las carpetas de salida seguirán el patrón <microservice>-liam-erd."

# Nota: Gateway y Agente IA no tienen modelos definidos en la fuente de verdad actual.
