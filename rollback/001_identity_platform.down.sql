-- =====================================================================
-- CEREBRO · Rollback de la migración 001 (inverso exacto)
-- =====================================================================
-- Deshace supabase/migrations/001_identity_platform.sql. Orden inverso de
-- dependencias. Idempotente (IF EXISTS).
-- =====================================================================

BEGIN;

-- Privilegios del rol de la app (el rol en sí se deja — es cluster-global y
-- la migración lo crea idempotente; para eliminarlo del todo, ver nota al final).
REVOKE ALL ON FUNCTION cerebro_resolve_owner(text, text) FROM cerebro_api;
REVOKE ALL ON FUNCTION cerebro_current_owner()           FROM cerebro_api;
REVOKE ALL ON owner, owner_platform_tenant, person, person_identity FROM cerebro_api;
REVOKE ALL ON platform FROM cerebro_api;

DROP POLICY IF EXISTS person_identity_scope        ON person_identity;
DROP POLICY IF EXISTS person_scope                 ON person;
DROP POLICY IF EXISTS owner_platform_tenant_scope  ON owner_platform_tenant;
DROP POLICY IF EXISTS owner_scope                  ON owner;
DROP POLICY IF EXISTS platform_read_all            ON platform;

DROP FUNCTION IF EXISTS cerebro_resolve_owner(text, text);
DROP FUNCTION IF EXISTS cerebro_current_owner();

DROP INDEX IF EXISTS idx_person_identity_person;
DROP INDEX IF EXISTS idx_person_identity_lookup;
DROP INDEX IF EXISTS idx_person_owner;
DROP INDEX IF EXISTS idx_owner_platform_tenant_owner;

DROP TABLE IF EXISTS person_identity;
DROP TABLE IF EXISTS person;
DROP TABLE IF EXISTS owner_platform_tenant;
DROP TABLE IF EXISTS owner;
DROP TABLE IF EXISTS platform;

-- La extensión `vector` la usan migraciones posteriores (Slice 2+): NO se elimina.
-- DROP EXTENSION IF EXISTS vector;

-- El rol cerebro_api se deja (cluster-global). Para eliminarlo del todo, tras
-- aplicar este rollback y sin objetos que dependan de él:
-- DROP ROLE IF EXISTS cerebro_api;

COMMIT;
