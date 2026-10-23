-- =====================================================================
-- CEREBRO · Rollback de la migración 001 (inverso exacto)
-- =====================================================================
-- Deshace supabase/migrations/001_identity_platform.sql. Orden inverso de
-- dependencias. Idempotente (IF EXISTS).
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS person_read_if_linked           ON person;
DROP POLICY IF EXISTS person_identity_read_own_platform ON person_identity;
DROP POLICY IF EXISTS platform_read_all               ON platform;

DROP INDEX IF EXISTS idx_person_merged_into;
DROP INDEX IF EXISTS idx_person_identity_person;
DROP INDEX IF EXISTS idx_person_identity_lookup;

DROP TABLE IF EXISTS person_identity;
DROP TABLE IF EXISTS person;
DROP TABLE IF EXISTS platform;

DROP FUNCTION IF EXISTS cerebro_current_platform();

-- La extensión `vector` la pueden usar migraciones posteriores (Slice 2+),
-- por eso NO se elimina aquí. Para un rollback total al estado pre-001,
-- descomentar bajo tu criterio:
-- DROP EXTENSION IF EXISTS vector;

COMMIT;
