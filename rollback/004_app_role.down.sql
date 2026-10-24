-- =====================================================================
-- CEREBRO · Rollback de la migración 004 (inverso exacto)
-- =====================================================================
-- Elimina el rol de login de la aplicación. ⚠ Asegúrate de que ninguna
-- conexión (DATABASE_URL de producción) lo esté usando antes de correrlo.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cerebro_app') THEN
    EXECUTE 'REVOKE cerebro_api FROM cerebro_app';
  END IF;
END $$;

DROP ROLE IF EXISTS cerebro_app;

COMMIT;
