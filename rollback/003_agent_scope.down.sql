-- =====================================================================
-- CEREBRO · Rollback de la migración 003 (inverso exacto)
-- =====================================================================
BEGIN;

REVOKE ALL ON agent_scope FROM cerebro_api;
DROP POLICY IF EXISTS agent_scope_read_all ON agent_scope;
DROP TABLE IF EXISTS agent_scope;

COMMIT;
