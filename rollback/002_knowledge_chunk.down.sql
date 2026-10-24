-- =====================================================================
-- CEREBRO · Rollback de la migración 002 (inverso exacto)
-- =====================================================================
BEGIN;

REVOKE ALL ON knowledge_chunk FROM cerebro_api;
DROP POLICY IF EXISTS knowledge_chunk_scope ON knowledge_chunk;
DROP INDEX IF EXISTS idx_chunk_embedding;
DROP INDEX IF EXISTS idx_chunk_owner_person;
DROP TABLE IF EXISTS knowledge_chunk;

-- La extensión `vector` la usan otras capas; NO se elimina aquí.
COMMIT;
