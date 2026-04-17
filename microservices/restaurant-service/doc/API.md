# Restaurant Service — API

Contrato API para el microservicio Restaurantes. Cubre CRUD de restaurantes y productos, filtros y respuestas para consumo por frontend y otros microservicios.

Autenticación
- Endpoints de creación/edición/eliminación requieren JWT con rol `admin` o rol propio del restaurante (si se modela). Listados públicos pueden ser anónimos.

Modelos (resumen)
- Restaurante: id, nombre, descripcion, direccion, categoria, imagenUrl, isActive, createdAt, updatedAt
- Producto: id, restauranteId, nombre, descripcion, precio, disponible, createdAt, updatedAt

Endpoints HTTP

1) Crear restaurante
- POST /restaurants
- Roles: admin
- Body:
  {
    "nombre": "string",
    "descripcion": "string?",
    "direccion": "string",
    "categoria": "string",
    "imagenUrl": "string?"
  }
- Validaciones: nombre y direccion requeridos
- Respuesta: 201 Created con recurso

2) Listar restaurantes
- GET /restaurants?categoria=&isActive=&q=&limit=&offset=
- Público
- Filtros:
  - categoria: exact match
  - q: búsqueda por nombre/descripcion (simple ILIKE)
  - isActive: true/false
- Respuesta: paginada, cada ítem con resumen (id, nombre, categoria, imagenUrl, isActive)

3) Obtener restaurante por id (incluye menú)
- GET /restaurants/{restaurantId}
- Respuesta: objeto Restaurante + productos (solo disponibles o todos según query param includeUnavailable=false)

4) Actualizar restaurante
- PATCH /restaurants/{restaurantId}
- Roles: admin
- Body: campos parciales permitidos
- Respuesta: 200 con recurso actualizado

5) Activar / Desactivar restaurante
- POST /restaurants/{restaurantId}/activate
- POST /restaurants/{restaurantId}/deactivate
- Roles: admin
- Efecto: set isActive true/false

6) CRUD Productos
- Crear producto: POST /restaurants/{restaurantId}/products
  - Body: { nombre, descripcion?, precio, disponible? }
  - Roles: admin
  - Validar precio >= 0
- Listar productos: GET /restaurants/{restaurantId}/products?disponible=
- Obtener producto: GET /products/{productId}
- Actualizar producto: PATCH /products/{productId}
- Eliminar producto: DELETE /products/{productId} (soft delete recomendado: poner disponible=false)

Integración con order-service
- order-service debe poder consultar productos por id para validar precio y nombre al crear un pedido. Proveer endpoint:
  - POST /products/validate-batch
  - Body: [ { productId, precioUnit } ]
  - Respuesta: lista con { productId, ok: bool, serverPrecio, nombre, disponible }
- Este endpoint permite validar atomically los items del pedido y devolver discrepancias.

Eventos RabbitMQ
- restaurant.created, restaurant.updated, product.created, product.updated, product.deleted
- Payloads resumidos para que otros servicios (p.ej. search, gateway) indexen

Buenas prácticas
- Control de consistencia: cuando se actualiza precio, publicar evento product.updated para que order-service pueda invalidar caches
- Soft deletes para productos (no borrar físicamente)
- Limitar ancho de respuesta: listar productos con paginación y campos resumidos

Errores y códigos HTTP
- Estándares: 200,201,400,401,403,404,409,500

Consideraciones de diseño
- Indizar por categoria e isActive (ya en schema)
- Validación server-side de precios y tipos
- Documentar límites: max productos por restaurante, longitud de strings

---
