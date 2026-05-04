# 🔗 Flujos reales (solo conexiones útiles)

## 1) Crear pedido

### Conexiones

- **Order → Restaurant (HTTP)** ----> COMPLETO Y CON TESTS PASANDO
  Acción: validar productos
  Razón: consistencia inmediata

- **Order → Notificaciones (HTTP)** ----> COMPLETO Y CON TESTS PASANDO

  Acción: crear notificación
  Razón: feedback inmediato

---

## 2) Aceptar pedido

### Conexiones

- **Order → Notificaciones (HTTP)**

---

## 3) Cambiar estado pedido

### Conexiones

- **Order → Notificaciones (HTTP)**

---

## 4) Entregar pedido (ÚNICO caso con valor real)

### Conexiones

- **Order → Notificaciones (HTTP)**

### Consumidor

- **Rating ← RabbitMQ**
  Acción: habilitar rating

👉 Este sí tiene sentido:

- hay consumidor
- elimina polling
- desacopla lógica

---

## 5) Cancelar pedido

### Conexiones

- **Order → Notificaciones (HTTP)**

---

## 6) Calificaciones

### Conexión real

- **Rating ← RabbitMQ**
  Evento: `order.delivered`

---

# 🧠 Resultado limpio (sin humo)

## HTTP (todo lo crítico)

- Order → Restaurant ✔
- Order → Notificaciones ✔

---

## RabbitMQ (mínimo útil)

- **Order → `order.delivered`**
- **Rating ← `order.delivered`**
