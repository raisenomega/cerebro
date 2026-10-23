-- =====================================================================
-- Test adversarial de RLS — person_identity (Slice 1 · criterio §4 del brief)
-- =====================================================================
-- Verifica la propiedad de grado bancario: un "tenant" (plataforma) NO puede
-- leer person_identity de otro.
--
-- Requiere un Postgres con la migración 001 aplicada. Correr con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_person_identity.sql
--   (o: bash scripts/test-rls.sh)
--
-- Pasa => imprime 'RLS OK …' y sale 0. Falla => RAISE EXCEPTION y aborta ≠0.
-- No deja residuo: todo corre en una transacción que termina en ROLLBACK.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

-- Rol de prueba SUJETO a RLS (sin BYPASSRLS), aislado del service_role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cerebro_rls_test') THEN
    CREATE ROLE cerebro_rls_test NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO cerebro_rls_test;
GRANT SELECT ON platform, person, person_identity TO cerebro_rls_test;
GRANT EXECUTE ON FUNCTION cerebro_current_platform() TO cerebro_rls_test;

-- Seed de prueba como owner/service (bypass RLS): una identidad por plataforma.
-- Las plataformas nucleo/hub ya existen por el seed de 001.
WITH p_n AS (INSERT INTO person (display_name) VALUES ('RLS test · nucleo') RETURNING id),
     p_h AS (INSERT INTO person (display_name) VALUES ('RLS test · hub')    RETURNING id)
INSERT INTO person_identity (person_id, source_platform, id_type, id_value, id_normalized)
SELECT id, 'nucleo', 'email', 'rls-n@test.local', 'rls-n@test.local' FROM p_n
UNION ALL
SELECT id, 'hub',    'email', 'rls-h@test.local', 'rls-h@test.local' FROM p_h;

-- --- Adversarial: actuar como la plataforma 'hub' e intentar leer 'nucleo' ---
SET LOCAL cerebro.platform = 'hub';
SET LOCAL ROLE cerebro_rls_test;

DO $$
DECLARE
  leak_count int;
  own_count  int;
BEGIN
  -- NO debe ver NINGUNA fila de otra plataforma (nucleo).
  SELECT count(*) INTO leak_count
  FROM person_identity WHERE source_platform = 'nucleo';
  IF leak_count <> 0 THEN
    RAISE EXCEPTION 'RLS FALLÓ: hub leyó % fila(s) de person_identity de nucleo (debe ser 0)', leak_count;
  END IF;

  -- SÍ debe ver sus propias filas (hub).
  SELECT count(*) INTO own_count
  FROM person_identity WHERE source_platform = 'hub';
  IF own_count < 1 THEN
    RAISE EXCEPTION 'RLS FALLÓ: hub no puede leer sus propias filas de person_identity (vio %)', own_count;
  END IF;

  RAISE NOTICE 'RLS OK · hub no ve nucleo (leak=%) y sí ve lo suyo (own=%)', leak_count, own_count;
END $$;

RESET ROLE;
ROLLBACK;  -- descarta los datos de prueba.
