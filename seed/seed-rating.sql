-- ───────────────────────────────────────────────────────────────
-- Seed Data — rating-db (SQLx: snake_case)
-- ───────────────────────────────────────────────────────────────

TRUNCATE TABLE pedidos_entregados, calificaciones_repartidor, calificaciones_restaurante CASCADE;

INSERT INTO calificaciones_restaurante (id, pedido_id, user_id, restaurante_id, estrellas, comentario, created_at, updated_at) VALUES
  ('22222222-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   5, 'Excelente pizza, llegó rápido y caliente. La mejor del barrio.',
   NOW() - INTERVAL '25 minutes', NOW());

INSERT INTO calificaciones_repartidor (id, pedido_id, user_id, repartidor_id, estrellas, comentario, created_at, updated_at) VALUES
  ('33333333-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002',
   5, 'Muy amable y puntual. Gracias María!',
   NOW() - INTERVAL '25 minutes', NOW());

INSERT INTO pedidos_entregados (id, pedido_id, user_id, repartidor_id, restaurante_id, delivered_at, created_at) VALUES
  ('44444444-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000001',
   NOW() - INTERVAL '30 minutes',
   NOW());
