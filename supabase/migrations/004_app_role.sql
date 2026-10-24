-- =====================================================================
-- CEREBRO · Migración 004 — Rol de login de la aplicación (producción)
-- =====================================================================
-- El DATABASE_URL de producción NO debe usar el superusuario `postgres`
-- (ignora RLS y rompe el aislamiento por owner). Se crea un rol de LOGIN de
-- aplicación, NOSUPERUSER + NOBYPASSRLS, miembro de `cerebro_api` (001) con
-- herencia: obtiene los privilegios de tabla/función pero la RLS se le aplica
-- igual que en los tests.
--
-- ⚠ El PASSWORD NO va en el repo (es secreto). Se fija FUERA del repo tras
--   aplicar esta migración (ver el bloque al final). Aquí el rol queda LOGIN
--   pero sin poder autenticarse hasta que se le ponga password.
--
-- Rollback: rollback/004_app_role.down.sql
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cerebro_app') THEN
    CREATE ROLE cerebro_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- Miembro de cerebro_api CON herencia: hereda SELECT/INSERT/UPDATE/DELETE de las
-- tablas y EXECUTE de las funciones, pero NO el bypass de RLS. No necesita
-- SET ROLE: con INHERIT los privilegios aplican directo al conectarse.
GRANT cerebro_api TO cerebro_app WITH INHERIT TRUE;

COMMIT;

-- =====================================================================
-- PASO DE DESPLIEGUE — FUERA DEL REPO (no commitear el password):
--   ALTER ROLE cerebro_app WITH PASSWORD '<password-fuerte-del-vault>';
-- Luego el DATABASE_URL (pooler de Supabase, session mode :5432) usa este rol:
--   postgresql://cerebro_app.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
-- =====================================================================
