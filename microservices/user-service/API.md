# User Service — API

Servicio de perfiles de usuario y repartidor. Contiene CRUD de perfiles, gestión de disponibilidad y listados para admin.

Autenticación
- Endpoints protegidos requieren JWT. Roles: `usuario`, `repartidor`, `admin`.

Nota de despliegue / acceso
- Todos los endpoints marcados como "internal" o de administración deben ser accesibles únicamente a través del API Gateway. Aunque el Gateway aún no esté implementado en la primera entrega, la API debe exigir un scope/claim específico (por ejemplo: `x-client: gateway`) o validación de origen para denotar llamadas internas.

ORM y persistencia
- Este servicio usará Entity Framework Core como ORM sobre PostgreSQL. El modelo debe mapear la entidad UserProfile y exponer migraciones y DbContext apropiadas.

Modelos (resumen)
- UserProfile: id, userId (ref Auth, NO exponer en endpoints públicos), tipo (usuario|repartidor), nombre, telefono, direccion, disponible, isActive, reservedUntil, createdAt, updatedAt

Schemas (resumen para OpenAPI)
- UserProfile
  - id: GUID
  - userId: GUID (referencia interna a Auth, NO exponer en endpoints públicos)
  - tipo: enum ("usuario","repartidor")
  - nombre: string
  - telefono: string
  - direccion: string
  - disponible: boolean
  - isActive: boolean
  - reservedUntil: datetime? (nullable) — usado para reserva atomica
  - createdAt: datetime
  - updatedAt: datetime

-- DTOs
- CreateProfileRequest: { tipo, nombre, telefono?, direccion? }
- UpdateProfileRequest: campos parciales editables
- AvailabilityRequest: { disponible: true|false }
- ReserveRequest: { ttlSeconds?: number }
- ErrorResponse: { code, message, details? }

Endpoints HTTP

1) Obtener perfil propio
- GET /profiles/me
- Roles: usuario, repartidor
- Respuesta: perfil asociado al userId del JWT

2) Crear/Registrar perfil
- POST /profiles
- Roles: autenticado (para completar perfil después de registrar en Auth)
- Body: CreateProfileRequest
- Server genera userId vinculándolo con JWT subject
- Respuesta: 201 Created

3) Actualizar perfil
- PATCH /profiles/me
- Body: UpdateProfileRequest
- Respuesta: 200 con perfil actualizado

4) Cambiar disponibilidad (repartidor)
- POST /profiles/me/availability
- Body: AvailabilityRequest
- Roles: repartidor
- Efecto:
  - actualizar campo disponible
  - publicar evento `repartidor.availability.changed` con { profileId, userId, disponible, timestamp }
- Respuesta: 200

5) Listar repartidores disponibles
- GET /profiles/delivery?limit=&offset=&near=&radius=&onlyAvailable=true
- Roles: internal (ACCESIBLE SOLO A TRAVÉS DEL GATEWAY). No exponer directamente al frontend hasta que el Gateway aplique controles.
- Filtros: onlyAvailable=true, near=lat,lon, radius (metros), limit, offset
- Respuesta: PaginatedResponse[UserProfile] con perfiles de tipo repartidor y disponible=true

6) Admin: listar/activar/desactivar usuarios
- GET /profiles?tipo=&isActive=&limit=&offset=
- POST /profiles/{profileId}/deactivate
- POST /profiles/{profileId}/activate
- Roles: admin

7) Obtener perfil por id
- GET /profiles/{profileId}
- Roles: admin OR owner (si el JWT subject coincide con userId) — ADMIN or internal via Gateway
- Respuesta: 200 con UserProfile (campos públicos) o 404

8) Eliminar / Borrar perfil (admin)
- DELETE /profiles/{profileId}
- Roles: admin
- Efecto: eliminar físicamente o marcar isActive=false (decidir implementacion). Respuesta: 204

9) Admin: actualizar perfil parcial
- PATCH /profiles/{profileId}
- Roles: admin
- Body: campos parciales
- Respuesta: 200

10) Búsqueda avanzada (internal)
- GET /profiles/search?tipo=&disponible=&near=&radius=&limit=&offset=
- Roles: internal
- Respuesta: PaginatedResponse[UserProfile]

11) Reserva atómica (internal) — para evitar race conditions al asignar repartidores
- POST /profiles/{profileId}/reserve
- Roles: internal (API Gateway / order-service)
- Body: ReserveRequest { ttlSeconds?: number }
- Comportamiento: intenta marcar reservedUntil = now + ttlSeconds ATÓMICAMENTE, solo si disponible=true y (reservedUntil IS NULL OR reservedUntil <= now)
- Respuestas: 200 OK con { reservedUntil } si éxito, 409 Conflict si ya reservado/indisponible

12) Liberar reserva (internal)
- POST /profiles/{profileId}/release
- Roles: internal
- Efecto: clear reservedUntil si el caller es el que reservó o si es admin
- Respuesta: 200

13) Obtener disponibilidad (opcional)
- GET /profiles/me/availability
- Roles: repartidor
- Respuesta: { disponible, reservedUntil }

Integración con order-service
- Escenarios:
  - order-service consulta lista de repartidores disponibles (GET /profiles/delivery?onlyAvailable=true)
  - order-service notifica asignación; user-service puede actualizar disponibilidad a false si se desea reservar
  - order-service y otros consumen eventos `repartidor.availability.changed`
- Nota: en este proyecto, GET /profiles/delivery y los endpoints de reserva son INTERNAL y deben ser invocados a través del API Gateway que autenticará y añadirá el claim/scope que identifica llamadas internas.

Eventos RabbitMQ
- repartidor.availability.changed — body: { profileId, userId, disponible, timestamp }
- profile.created — { profileId, userId, tipo, timestamp }
- profile.updated — { profileId, changes, timestamp }
- profile.deactivated — { profileId, reason?, timestamp }
- profile.reserved — { profileId, reservedBy?, reservedUntil, timestamp }
- profile.released — { profileId, releasedBy?, timestamp }

Buenas prácticas
- Evitar carrera de condición al asignar repartidor: cuando un repartidor acepta, order-service debe validar disponibilidad y publicar evento; user-service ofrece endpoint atomic reserve para coordinación segura.
- Indexar por userId (único), tipo y disponible (ya en schema).
- No exponer userId de Auth en respuestas públicas si no es necesario; usar id de perfil internamente.

Notas de implementación con EF Core
- Usar una migración inicial que cree la tabla UserProfiles con índices en (userId UNIQUE), (tipo), (disponible), (reservedUntil). Implementar la reserva atómica usando una transacción SQL que actualice reservedUntil con WHERE disponible=true AND (reservedUntil IS NULL OR reservedUntil <= now) — devolver filas afectadas para determinar éxito.
- El DbContext debe exponer métodos para: GetByUserId, ReserveProfileAtomic, ReleaseReservation, SetAvailability, AdminList, SearchWithGeo (si se implementa geo simple usando extensión PostGIS o cálculo Haversine en query si latitude/longitude guardados).

Errores y códigos HTTP
- 200,201,204,400,401,403,404,409,500

---
