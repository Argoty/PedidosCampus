-- ───────────────────────────────────────────────────────────────
-- Seed Data — order-db (GORM: snake_case)
-- ───────────────────────────────────────────────────────────────

TRUNCATE TABLE pedido_estado_logs, pedido_items, pedidos CASCADE;

INSERT INTO pedidos (id, user_id, restaurante_id, repartidor_id, estado, subtotal, costo_entrega, total, direccion_entrega, created_at, updated_at) VALUES

  -- Order 1: Juan → Pizzería Roma → entregado | repartidor: María
  -- Pizza Margherita x2 (20.00) + Pepperoni x1 (12.00) = 32.00 + envío 2.00 = 34.00
  ('eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002',
   'entregado', 32.00, 2.00, 34.00,
   'Av. Siempre Viva 123, CABA',
   NOW() - INTERVAL '2 hours', NOW()),

  -- Order 2: Ana → Sushi Express → en_camino | repartidor: Carlos
  -- Roll de Salmón x3 (25.50) + envío 2.00 = 27.50
  ('eeeeeeee-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'en_camino', 25.50, 2.00, 27.50,
   'Belgrano 321, CABA',
   NOW() - INTERVAL '1 hour', NOW()),

  -- Order 3: Juan → Hamburguesas Deluxe → pendiente | sin repartidor
  -- Clásica x2 (14.00) + envío 2.00 = 16.00
  ('eeeeeeee-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   NULL,
   'pendiente', 14.00, 2.00, 16.00,
   'Av. Siempre Viva 123, CABA',
   NOW(), NOW()),

  -- Order 4: Pedro → Empanadas La Criolla → aceptado | repartidor: Lucía
  -- Carne x6 (18.00) + Jamón x4 (11.20) = 29.20 + envío 2.00 = 31.20
  ('eeeeeeee-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'aceptado', 29.20, 2.00, 31.20,
   'San Martín 555, CABA',
   NOW() - INTERVAL '30 minutes', NOW()),

  -- Order 5: Ana → Helados Copo → pendiente | sin repartidor
  -- 1/4 kg x1 (6.00) + envío 2.00 = 8.00
  ('eeeeeeee-0000-0000-0000-000000000005',
   'aaaaaaaa-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000005',
   NULL,
   'pendiente', 6.00, 2.00, 8.00,
   'Belgrano 321, CABA',
   NOW(), NOW());

INSERT INTO pedido_items (id, pedido_id, product_id, nombre, precio_unit, cantidad, subtotal, created_at) VALUES
  -- Order 1
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'Pizza Margherita',  10.00, 2, 20.00, NOW()),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'Pizza Pepperoni',   12.00, 1, 12.00, NOW()),
  -- Order 2
  ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000006', 'Roll de Salmón',     8.50, 3, 25.50, NOW()),
  -- Order 3
  ('ffffffff-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-00000000000a', 'Clásica',            7.00, 2, 14.00, NOW()),
  -- Order 4
  ('ffffffff-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-00000000000e', 'Empanada de Carne',  3.00, 6, 18.00, NOW()),
  ('ffffffff-0000-0000-0000-000000000006', 'eeeeeeee-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000010', 'Empanada de Jamón y Queso', 2.80, 4, 11.20, NOW()),
  -- Order 5
  ('ffffffff-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000012', '1/4 kg (2 sabores)', 6.00, 1, 6.00, NOW());

INSERT INTO pedido_estado_logs (id, pedido_id, from_estado, to_estado, changed_by, created_at) VALUES

  -- Order 1: pendiente → aceptado → en_camino → entregado
  ('11111111-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', NULL,        'pendiente', 'aaaaaaaa-0000-0000-0000-000000000001', NOW() - INTERVAL '2 hours'),
  ('11111111-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'pendiente', 'aceptado',  'aaaaaaaa-0000-0000-0000-000000000002', NOW() - INTERVAL '105 minutes'),
  ('11111111-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'aceptado',  'en_camino', 'aaaaaaaa-0000-0000-0000-000000000002', NOW() - INTERVAL '90 minutes'),
  ('11111111-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', 'en_camino', 'entregado', 'aaaaaaaa-0000-0000-0000-000000000002', NOW() - INTERVAL '30 minutes'),

  -- Order 2: pendiente → aceptado → en_camino
  ('11111111-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000002', NULL,        'pendiente', 'aaaaaaaa-0000-0000-0000-000000000004', NOW() - INTERVAL '1 hour'),
  ('11111111-0000-0000-0000-000000000006', 'eeeeeeee-0000-0000-0000-000000000002', 'pendiente', 'aceptado',  'aaaaaaaa-0000-0000-0000-000000000003', NOW() - INTERVAL '45 minutes'),
  ('11111111-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-000000000002', 'aceptado',  'en_camino', 'aaaaaaaa-0000-0000-0000-000000000003', NOW() - INTERVAL '30 minutes'),

  -- Order 3: pendiente (recién creado)
  ('11111111-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0000-000000000003', NULL, 'pendiente', 'aaaaaaaa-0000-0000-0000-000000000001', NOW()),

  -- Order 4: pendiente → aceptado
  ('11111111-0000-0000-0000-000000000009', 'eeeeeeee-0000-0000-0000-000000000004', NULL,        'pendiente', 'aaaaaaaa-0000-0000-0000-000000000006', NOW() - INTERVAL '30 minutes'),
  ('11111111-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000004', 'pendiente', 'aceptado',  'aaaaaaaa-0000-0000-0000-000000000007', NOW() - INTERVAL '15 minutes'),

  -- Order 5: pendiente (recién creado)
  ('11111111-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000005', NULL, 'pendiente', 'aaaaaaaa-0000-0000-0000-000000000004', NOW());
