-- ───────────────────────────────────────────────────────────────
-- Seed Data — user-db (EF Core: camelCase)
-- ───────────────────────────────────────────────────────────────

TRUNCATE TABLE usuario_perfiles CASCADE;

INSERT INTO usuario_perfiles (id, "userId", tipo, nombre, telefono, direccion, disponible, "isActive", "reservedUntil", "createdAt", "updatedAt") VALUES

  ('bbbbbbbb-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'usuario', 'Juan Pérez', '1134567890', 'Av. Siempre Viva 123, CABA',
   false, true, NULL, NOW(), NOW()),

  ('bbbbbbbb-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000002',
   'repartidor', 'María García', '1145678901', 'Calle Falsa 456, CABA',
   true, true, NULL, NOW(), NOW()),

  ('bbbbbbbb-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'repartidor', 'Carlos López', '1156789012', 'Av. Corrientes 789, CABA',
   true, true, NULL, NOW(), NOW()),

  ('bbbbbbbb-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000004',
   'usuario', 'Ana Martínez', '1167890123', 'Belgrano 321, CABA',
   false, true, NULL, NOW(), NOW()),

  ('bbbbbbbb-0000-0000-0000-000000000005',
   'aaaaaaaa-0000-0000-0000-000000000005',
   'usuario', 'Admin Sistema', NULL, NULL,
   false, true, NULL, NOW(), NOW()),

  ('bbbbbbbb-0000-0000-0000-000000000006',
   'aaaaaaaa-0000-0000-0000-000000000006',
   'usuario', 'Pedro Ramírez', '1178901234', 'San Martín 555, CABA',
   false, true, NULL, NOW(), NOW()),

  ('bbbbbbbb-0000-0000-0000-000000000007',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'repartidor', 'Lucía Fernández', '1189012345', 'Rivadavia 888, CABA',
   true, true, NULL, NOW(), NOW());
