-- =====================================================================
-- Test — el rol de app `cerebro_app` respeta RLS (Slice deploy · migración 004)
-- =====================================================================
-- Verifica, actuando como el ROL DE PRODUCCIÓN `cerebro_app` (NOSUPERUSER,
-- NOBYPASSRLS):
--   (1) SIN contexto de owner -> SELECT sobre person_identity devuelve 0 filas
--       (la RLS se le aplica; no es superusuario),
--   (2) CON contexto (SET LOCAL app.current_owner_id, sin superusuario) -> ve
--       las filas de ese owner (confirma que set_config funciona con ese rol).
--
-- Requiere migraciones 001 + 004 aplicadas. Correr con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/app_role_rls.sql
-- Pasa => 'APP ROLE OK …' y sale 0. No deja residuo (ROLLBACK).
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

GRANT cerebro_app TO current_user;   -- permite SET ROLE (revertido en ROLLBACK)

-- Datos de prueba (como owner/bypass, antes del SET ROLE)
INSERT INTO owner (id, name) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'app_role test');
INSERT INTO person (id, owner_id, display_name)
VALUES ('c0000000-0000-4000-8000-00000000000c', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'p');
INSERT INTO person_identity (owner_id, person_id, source_platform, id_type, id_value, id_normalized)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c0000000-0000-4000-8000-00000000000c',
        'nucleo', 'email', 'app@test', 'app@test');

SET LOCAL ROLE cerebro_app;   -- de aquí en adelante, el rol real de producción

-- (1) SIN contexto -> 0 filas (RLS activa sobre cerebro_app)
SET LOCAL app.current_owner_id = '';
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM person_identity;
  IF v <> 0 THEN
    RAISE EXCEPTION 'FALLÓ (1): cerebro_app SIN contexto vio % filas (debe ser 0 = respeta RLS)', v;
  END IF;
END $$;

-- (2) CON contexto del owner de prueba -> ve su fila (set_config sin superusuario)
SET LOCAL app.current_owner_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM person_identity;
  IF v < 1 THEN
    RAISE EXCEPTION 'FALLÓ (2): cerebro_app CON contexto vio % (debe ser >=1)', v;
  END IF;
  RAISE NOTICE 'APP ROLE OK · sin contexto=0 (RLS respetada), con contexto>=1 (set_config funciona sin superusuario)';
END $$;

RESET ROLE;
ROLLBACK;
