# PedidosCampus — Documentación del Proyecto
### Arquitectura de Microservicios Asíncronos
**Electiva Backend · 5° Semestre Ingeniería de Software**  
**Integrantes:** Javier Leonardo Argoty Roa · Simon David Cruz Suazo  
**Fecha de entrega parcial:** 18/04/2026  
**Fecha de entrega final:** 

---

## 1. Descripción General del Proyecto

PedidosCampus es una plataforma de entregas y pedidos a domicilio enfocada en el entorno universitario. Permite a estudiantes y personal del campus realizar pedidos a restaurantes, tiendas y servicios locales cercanos, los cuales son atendidos por repartidores registrados en la plataforma.

El sistema está construido bajo una arquitectura de **microservicios asíncronos**, donde cada dominio del negocio es un servicio independiente con su propia base de datos y tecnología. Los servicios con estado persistente se ejecutan en contenedores Docker para desarrollo local, y el microservicio de Notificaciones opera en un runtime serverless nativo (Cloudflare Workers). La comunicación entre servicios se realiza mediante un **broker de mensajería (RabbitMQ)**, garantizando desacoplamiento y resiliencia. Un **API Gateway** centraliza el acceso, aplica políticas de seguridad y enruta las peticiones a cada microservicio.

La plataforma cuenta con tres tipos de actores: **usuarios** (realizan pedidos), **repartidores** (aceptan y entregan pedidos) y **administradores** (gestionan la plataforma y acceden al agente de IA). Un agente de inteligencia artificial integrado asiste al administrador en la toma de decisiones sobre el estado del negocio.

### Características Principales

- Registro, autenticación y autorización con JWT + Refresh Token
- Gestión de restaurantes, menús y productos
- Ciclo completo de pedidos: creación, aceptación, seguimiento y entrega
- Notificaciones asíncronas entre servicios vía RabbitMQ
- Calificaciones de restaurantes y repartidores
- Agente de IA para administración
- Despliegue completo en la nube con frontend incluido

---

## 2. Stack Tecnológico

| Microservicio | Tecnología | Base de Datos | Tipo |
|---|---|---|---|
| Gateway | NestJS | — | Enrutamiento y seguridad |
| Auth | NestJS + Passport | PostgreSQL | JWT, Refresh Token, Roles |
| Usuarios | C# .NET 8 | PostgreSQL | Clientes y repartidores |
| Restaurantes | Python + FastAPI | PostgreSQL | Menús y productos |
| Pedidos | Go + Gin | PostgreSQL | Core del negocio |
| Notificaciones | TypeScript (Cloudflare Workers) | Cloudflare KV | Serverless |
| Calificaciones | Rust + Actix-web | PostgreSQL | Reviews y promedios |
| Agente IA | Python + FastAPI | — | LLM integrado para admin |

**Broker de mensajería:** RabbitMQ  
**Ejecución local:** Docker + Docker Compose (servicios en contenedor) y Wrangler para servicios serverless  
**Frontend:** [Tecnología por definir — React / Next.js sugerido]

---

## 3. Requisitos Funcionales

### RF-AUTH — Microservicio de Autenticación

| ID | Requisito |
|---|---|
| RF-AUTH-01 | El sistema debe permitir el registro de nuevos usuarios con nombre, correo y contraseña |
| RF-AUTH-02 | El sistema debe autenticar usuarios mediante correo y contraseña, retornando un access token JWT y un refresh token |
| RF-AUTH-03 | El access token debe tener una expiración corta (15 minutos) |
| RF-AUTH-04 | El refresh token debe tener una expiración larga (7 días) y almacenarse en una cookie HttpOnly |
| RF-AUTH-05 | El sistema debe permitir renovar el access token usando un refresh token válido sin requerir nueva autenticación |
| RF-AUTH-06 | El sistema debe invalidar el refresh token al cerrar sesión (logout) |
| RF-AUTH-07 | El sistema debe soportar tres roles: `usuario`, `repartidor` y `admin` |
| RF-AUTH-08 | El gateway debe validar el JWT en cada petición antes de enrutar al microservicio destino |

### RF-USR — Microservicio de Usuarios

| ID | Requisito |
|---|---|
| RF-USR-01 | El sistema debe permitir consultar el perfil de un usuario autenticado |
| RF-USR-02 | El sistema debe permitir actualizar los datos del perfil (nombre, teléfono, dirección) |
| RF-USR-03 | El sistema debe gestionar perfiles de repartidores incluyendo su disponibilidad (activo/inactivo) |
| RF-USR-04 | El administrador debe poder listar todos los usuarios y repartidores registrados |
| RF-USR-05 | El sistema debe permitir desactivar cuentas de usuarios o repartidores |

### RF-REST — Microservicio de Restaurantes

| ID | Requisito |
|---|---|
| RF-REST-01 | El sistema debe permitir registrar restaurantes con nombre, descripción, dirección y categoría |
| RF-REST-02 | El sistema debe permitir agregar, editar y eliminar productos del menú de un restaurante |
| RF-REST-03 | Cada producto debe tener nombre, descripción, precio y disponibilidad (activo/inactivo) |
| RF-REST-04 | El sistema debe permitir listar todos los restaurantes activos |
| RF-REST-05 | El sistema debe permitir filtrar restaurantes por categoría |
| RF-REST-06 | El sistema debe permitir consultar el menú completo de un restaurante |

### RF-PED — Microservicio de Pedidos

| ID | Requisito |
|---|---|
| RF-PED-01 | El sistema debe permitir a un usuario crear un pedido seleccionando restaurante y productos |
| RF-PED-02 | Un pedido debe pasar por los estados: `pendiente` → `aceptado` → `en_camino` → `entregado` |
| RF-PED-03 | Un repartidor disponible debe poder aceptar un pedido en estado `pendiente` |
| RF-PED-04 | El repartidor asignado debe poder actualizar el estado del pedido |
| RF-PED-05 | El usuario debe poder consultar el estado actual de su pedido |
| RF-PED-06 | El sistema debe publicar un evento en RabbitMQ cada vez que un pedido cambie de estado |
| RF-PED-07 | El usuario debe poder ver su historial de pedidos |
| RF-PED-08 | El administrador debe poder ver todos los pedidos activos y el historial general |

### RF-NOTIF — Microservicio de Notificaciones (Cloudflare Workers + KV)

| ID | Requisito |
|---|---|
| RF-NOTIF-01 | El sistema debe consumir eventos del broker RabbitMQ para generar notificaciones |
| RF-NOTIF-02 | Cada notificación debe registrarse en MongoDB con destinatario, mensaje, tipo y timestamp |
| RF-NOTIF-03 | El sistema debe permitir consultar las notificaciones de un usuario específico |
| RF-NOTIF-04 | El sistema debe marcar notificaciones como leídas |
| RF-NOTIF-05 | El microservicio debe estar desplegado como función serverless |

### RF-CAL — Microservicio de Calificaciones

| ID | Requisito |
|---|---|
| RF-CAL-01 | El sistema debe permitir calificar un restaurante al completar un pedido (1 a 5 estrellas + comentario) |
| RF-CAL-02 | El sistema debe permitir calificar al repartidor al completar un pedido |
| RF-CAL-03 | Solo se puede calificar un pedido una vez por parte del usuario |
| RF-CAL-04 | El sistema debe calcular y retornar el promedio de calificaciones de un restaurante |
| RF-CAL-05 | El sistema debe calcular y retornar el promedio de calificaciones de un repartidor |

### RF-IA — Microservicio de Agente IA

| ID | Requisito |
|---|---|
| RF-IA-01 | El administrador debe poder interactuar con un agente de IA mediante lenguaje natural |
| RF-IA-02 | El agente debe poder responder preguntas sobre el estado general de la plataforma |
| RF-IA-03 | El agente debe poder consultar métricas básicas: pedidos activos, restaurantes top, repartidores disponibles |
| RF-IA-04 | El acceso al agente debe estar restringido exclusivamente al rol `admin` |

### RF-GW — API Gateway

| ID | Requisito |
|---|---|
| RF-GW-01 | El gateway debe enrutar las peticiones al microservicio correspondiente según la ruta |
| RF-GW-02 | El gateway debe validar el JWT en cada petición protegida antes de enrutar |
| RF-GW-03 | El gateway debe aplicar políticas de CORS para el frontend |
| RF-GW-04 | El gateway debe retornar errores estandarizados cuando un microservicio no esté disponible |

---

## 4. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Cada microservicio con runtime de servidor debe tener su Dockerfile; los microservicios serverless deben usar configuración declarativa de despliegue (Wrangler) |
| RNF-02 | El proyecto debe poder ejecutarse localmente con Docker Compose (servicios en contenedor) y con `wrangler dev` para el servicio serverless de Notificaciones |
| RNF-03 | Cada microservicio debe tener pruebas unitarias con cobertura mínima de los endpoints principales |
| RNF-04 | La comunicación asíncrona entre servicios debe realizarse exclusivamente mediante RabbitMQ |
| RNF-05 | Las contraseñas deben almacenarse con hash bcrypt, nunca en texto plano |
| RNF-06 | El refresh token debe transmitirse únicamente mediante cookie HttpOnly para mitigar XSS |
| RNF-07 | Todos los endpoints protegidos deben requerir un JWT válido con el rol correspondiente |

---

## 5. Alcance de la Primera Entrega

Para la primera entrega se presentarán los siguientes componentes funcionales, **sin conexión entre ellos y sin despliegue en producción**:

- Microservicio Auth (NestJS) — JWT + Refresh Token + Roles
- Microservicio Usuarios (C# .NET) — CRUD básico
- Microservicio Restaurantes (FastAPI) — CRUD restaurantes y menú
- Microservicio Pedidos (Go) — Ciclo de estados del pedido
- Microservicio Notificaciones (Cloudflare Workers + KV) — Registro y lectura de notificaciones serverless
- Todos los microservicios dockerizados
- Pruebas unitarias por microservicio
- Documentación completa (requisitos + diagramas)

> Los microservicios de Calificaciones, Agente IA y el Gateway completo se entregarán en la versión final del semestre junto con la integración, el broker de mensajería activo y el despliegue en producción.
