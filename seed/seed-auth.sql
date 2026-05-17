-- ───────────────────────────────────────────────────────────────
-- Seed Data — auth-db (Prisma: camelCase)
-- Password plano para TODOS: password123
-- Hash bcrypt: $2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me
-- Generado con bcryptjs para password123.
-- $2b$ y $2a$ son interoperables para passwords ASCII.

TRUNCATE TABLE refresh_tokens, auth_users CASCADE;

INSERT INTO auth_users (id, nombre, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Juan Pérez',       'juan@email.com',       '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'usuario',    true, NOW(), NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'María García',     'maria@email.com',      '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'repartidor', true, NOW(), NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Carlos López',     'carlos@email.com',     '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'repartidor', true, NOW(), NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ana Martínez',     'ana@email.com',        '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'usuario',    true, NOW(), NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Admin Sistema',    'admin@email.com',      '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'admin',      true, NOW(), NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Pedro Ramírez',    'pedro@email.com',      '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'usuario',    true, NOW(), NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Lucía Fernández',  'lucia@email.com',      '$2b$10$AZUNSwaUWLGZGUgnGLnEIe.dgfnlnABElhncgkLX8AkU5etJvg4Me', 'repartidor', true, NOW(), NOW());
