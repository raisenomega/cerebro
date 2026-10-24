-- =====================================================================
-- Test de scope — agent_scope (Slice 3 · migración 003)
-- =====================================================================
-- Verifica, como el ROL REAL de la app (cerebro_api, sujeto a RLS read-all):
--   (a) el seed §3 quedó exacto (victor=4; eco=2 sin financial; angel con
--       pii_sensitive y sin financial),
--   (b) fail-closed: un agente desconocido NO tiene filas (retrieve -> vacío).
--
-- Requiere las migraciones 001 + 003 aplicadas. Correr con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/scope_agent_scope.sql
-- Pasa => 'SCOPE OK …' y sale 0. Falla => RAISE EXCEPTION. No deja residuo.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

GRANT cerebro_api TO current_user;   -- habilita SET ROLE (PG16+; revertido en ROLLBACK)
SET LOCAL ROLE cerebro_api;

DO $$
DECLARE
  v        int;
  has_fin  boolean;
  has_pii  boolean;
BEGIN
  -- (a) seed exacto
  SELECT count(*) INTO v FROM agent_scope WHERE agent_code = 'victor';
  IF v <> 4 THEN RAISE EXCEPTION 'victor debe ver 4 visibilidades, vio %', v; END IF;

  SELECT count(*) INTO v FROM agent_scope WHERE agent_code = 'eco';
  IF v <> 2 THEN RAISE EXCEPTION 'eco debe ver 2 (public,internal), vio %', v; END IF;
  SELECT bool_or(visibility = 'financial') INTO has_fin FROM agent_scope WHERE agent_code = 'eco';
  IF COALESCE(has_fin, false) THEN RAISE EXCEPTION 'eco NO debe tener financial'; END IF;

  SELECT bool_or(visibility = 'pii_sensitive') INTO has_pii FROM agent_scope WHERE agent_code = 'angel';
  SELECT bool_or(visibility = 'financial')     INTO has_fin FROM agent_scope WHERE agent_code = 'angel';
  IF NOT COALESCE(has_pii, false) THEN RAISE EXCEPTION 'angel debe tener pii_sensitive'; END IF;
  IF COALESCE(has_fin, false)     THEN RAISE EXCEPTION 'angel NO debe tener financial'; END IF;

  -- (b) fail-closed: agente desconocido -> 0 filas
  SELECT count(*) INTO v FROM agent_scope WHERE agent_code = 'agente-fantasma';
  IF v <> 0 THEN RAISE EXCEPTION 'agente desconocido debe ver 0, vio %', v; END IF;

  RAISE NOTICE 'SCOPE OK · victor=4, eco=2 (sin financial), angel con pii y sin financial, desconocido=0';
END $$;

RESET ROLE;
ROLLBACK;
