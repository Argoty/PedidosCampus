-- ───────────────────────────────────────────────────────────────
-- Seed Data — restaurant-db (SQLAlchemy: snake_case)
-- ───────────────────────────────────────────────────────────────

TRUNCATE TABLE productos, restaurantes CASCADE;

INSERT INTO restaurantes (id, nombre, descripcion, direccion, categoria, imagen_url, is_active, created_at, updated_at) VALUES
  -- Imágenes reales desde Pexels (licencia libre: https://www.pexels.com/license/)
  ('cccccccc-0000-0000-0000-000000000001',
   'Pizzería Roma', 'La mejor pizza al horno de leña del centro',
   'Av. Mayo 111, CABA', 'pizzas',
   'https://images.pexels.com/photos/6969975/pexels-photo-6969975.jpeg?auto=compress&cs=tinysrgb&w=800', true, NOW(), NOW()),

  ('cccccccc-0000-0000-0000-000000000002',
   'Sushi Express', 'Sushi fresco con delivery rápido',
   'Av. Santa Fe 2222, CABA', 'sushi',
   'https://images.pexels.com/photos/31393439/pexels-photo-31393439.jpeg?auto=compress&cs=tinysrgb&w=800', true, NOW(), NOW()),

  ('cccccccc-0000-0000-0000-000000000003',
   'Hamburguesas Deluxe', 'Hamburguesas artesanales con papas',
   'Av. Cabildo 3333, CABA', 'hamburguesas',
   'https://images.pexels.com/photos/23910872/pexels-photo-23910872.jpeg?auto=compress&cs=tinysrgb&w=800', true, NOW(), NOW()),

  ('cccccccc-0000-0000-0000-000000000004',
   'Empanadas La Criolla', 'Empanadas caseras y tradicionales',
   'Av. Boedo 444, CABA', 'empanadas',
   'https://images.pexels.com/photos/13689920/pexels-photo-13689920.jpeg?auto=compress&cs=tinysrgb&w=800', true, NOW(), NOW()),

  ('cccccccc-0000-0000-0000-000000000005',
   'Helados Copo', 'Helados artesanales made in Palermo',
   'Av. Scalabrini Ortiz 555, CABA', 'helados',
   'https://images.pexels.com/photos/1666635/pexels-photo-1666635.jpeg?auto=compress&cs=tinysrgb&w=800', true, NOW(), NOW());

INSERT INTO productos (id, restaurante_id, nombre, descripcion, precio, disponible, created_at, updated_at) VALUES
  -- Pizzería Roma
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Pizza Margherita',      'Muzzarella, albahaca, oliva',              10.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'Pizza Pepperoni',       'Pepperoni, muzzarella, salsa',             12.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'Pizza Napolitana',      'Anchoas, alcaparras, muzzarella',          11.50, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', 'Pizza Cuatro Quesos',   'Roquefort, parmesano, muzzarella, fontina', 13.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001', 'Pizza Fugazza',         'Cebolla, oliva, parmesano',                 10.50, true, NOW(), NOW()),
  -- Sushi Express
  ('dddddddd-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000002', 'Roll de Salmón',        'Salmón fresco, arroz, algas',                8.50, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000002', 'Nigiri Mix',            '12 piezas variadas',                        15.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000002', 'Tempura Roll',          'Langostinos en tempura, queso crema',        9.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000002', 'California Roll',       'Palta, cangrejo, pepino',                    9.50, true, NOW(), NOW()),
  -- Hamburguesas Deluxe
  ('dddddddd-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000003', 'Clásica',               'Carne, lechuga, tomate, cheddar',            7.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000003', 'Doble Carne',           'Doble medallón, bacon, cheddar',            10.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000003', 'BBQ Bacon',             'Bacon, cebolla caramelizada, salsa BBQ',     9.50, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-00000000000d', 'cccccccc-0000-0000-0000-000000000003', 'Veggie',                'Medallón de garbanzo, vegetales grillados',  8.00, true, NOW(), NOW()),
  -- Empanadas La Criolla
  ('dddddddd-0000-0000-0000-00000000000e', 'cccccccc-0000-0000-0000-000000000004', 'Empanada de Carne',     'Carne picada, huevo, aceituna',              3.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-00000000000f', 'cccccccc-0000-0000-0000-000000000004', 'Empanada de Pollo',     'Pollo, salsa blanca, verduras',              3.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000010', 'cccccccc-0000-0000-0000-000000000004', 'Empanada de Jamón y Queso', 'Jamón, muzzarella',                      2.80, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000011', 'cccccccc-0000-0000-0000-000000000004', 'Empanada de Verdura',   'Espinaca, ricota, nuez',                    2.80, true, NOW(), NOW()),
  -- Helados Copo
  ('dddddddd-0000-0000-0000-000000000012', 'cccccccc-0000-0000-0000-000000000005', '1/4 kg (2 sabores)',    'Dos sabores a elección',                     6.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000013', 'cccccccc-0000-0000-0000-000000000005', '1/2 kg (3 sabores)',    'Tres sabores a elección',                    9.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000014', 'cccccccc-0000-0000-0000-000000000005', '1 kg (4 sabores)',      'Cuatro sabores a elección',                  14.00, true, NOW(), NOW()),
  ('dddddddd-0000-0000-0000-000000000015', 'cccccccc-0000-0000-0000-000000000005', 'Pote Personal',         'Un sabor, 300g',                             4.00, true, NOW(), NOW());
