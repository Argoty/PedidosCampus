# Notificaciones Service - PedidosCampus

Microservicio serverless de notificaciones usando Cloudflare Workers (TypeScript) y Cloudflare KV.

## Stack

- Runtime: Cloudflare Workers
- Lenguaje: TypeScript
- Persistencia NoSQL: Cloudflare KV
- CLI: Wrangler

## Endpoints

- `POST /notifications`
- `GET /notifications/:userId`
- `PATCH /notifications/:id/leer`
- `GET /health`

Todos los endpoints (incluyendo `GET /health`) requieren header interno:

- `x-service-token: <SERVICE_TOKEN>`

## Modelo de datos (basado en `notificaciones-schema.prisma`)

Se mantiene el mismo contrato logico del modelo original:

- `id`
- `userId`
- `tipo`
- `mensaje`
- `payload`
- `leida`
- `createdAt`
- `readAt`

En KV:

- Clave primaria: `notif:{userId}:{createdAtMs}`
- Valor: JSON de la notificacion
- Indice por id: `notif_id:{id}` -> `notif:{userId}:{createdAtMs}`

El indice por id permite resolver `PATCH /notificaciones/:id/leer` con operaciones KV nativas (`get` + `put`) sin escaneo completo.

## Operaciones KV implementadas

- Crear (`put`): guarda la notificacion con clave `notif:{userId}:{createdAtMs}`
- Listar por usuario (`list` + `get`): usa prefijo `notif:{userId}:`
- Obtener por id (`get`): busca primero `notif_id:{id}` para encontrar la clave primaria
- Actualizar leida (`put`): reescribe el JSON marcando `leida=true` y `readAt`

## RabbitMQ en el futuro

`POST /notificaciones` hoy simula la llegada de un evento asincorno.
En una integracion real:

1. Pedidos publica eventos en RabbitMQ.
2. Un consumidor dedicado (Worker/Queue Consumer) transforma el evento.
3. Ese consumidor invoca la misma capa de persistencia usada por este endpoint.

Asi se mantiene compatibilidad del contrato HTTP actual sin acoplar la logica de negocio a la simulacion.

## Configuracion de Cloudflare KV

1. Login en Cloudflare:
   - `npx wrangler login`
2. Crear namespace KV (produccion):
   - `npx wrangler kv namespace create NOTIFICATIONS`
3. Crear namespace KV (preview/local remoto):
   - `npx wrangler kv namespace create NOTIFICATIONS --preview`
4. Copiar `id` y `preview_id` al archivo `wrangler.toml`.
5. Usar el binding en codigo mediante `env.NOTIFICATIONS`.

## Variables de entorno

Este microservicio requiere `SERVICE_TOKEN` como secret en Cloudflare Workers.
Usa:

- `.dev.vars` para desarrollo local (no versionar)
- `wrangler secret put <NOMBRE>` para produccion

Ejemplo en produccion:

- `wrangler secret put SERVICE_TOKEN`

## Ejecutar localmente

1. Instalar dependencias:
   - `npm install`
2. Levantar worker:
   - `npm run dev`

Por defecto `wrangler dev` usa estado local de KV.
Si necesitas probar contra KV remoto:

- `npx wrangler dev --remote`

## Despliegue

- `npm run deploy`

Comando equivalente:

- `npx wrangler deploy`

## Pruebas

- `npm test`
- `npm run typecheck`
