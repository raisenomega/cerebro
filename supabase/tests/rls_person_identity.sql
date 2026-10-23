-- =====================================================================
-- Test adversarial de RLS — identidad por owner (Slice 1 · §6 de la Decisión)
-- =====================================================================
-- Verifica las tres propiedades de grado bancario:
--   (a) AISLAMIENTO:   owner A no lee person_identity de owner B (RLS).
--   (b) NO CRUCE:      el mismo email bajo owner A y owner B => person_id DISTINTOS.
--   (c) EL "AJÁ":      el mismo email (nucleo y hub) del MISMO owner => MISMA person
--                      (lo garantiza el UNIQUE (owner_id, id_type, id_normalized)).
--
-- Requiere un Postgres con la migración 001 aplicada. Correr con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_person_identity.sql
--   (o: bash scripts/test-rls.sh)
-- Pasa => imprime 'RLS OK …' y sale 0. Falla => RAISE EXCEPTION y aborta ≠0.
-- Corre como el ROL REAL de la app (cerebro_api, SIN BYPASSRLS). No deja residuo
-- (todo dentro de una transacción que termina en ROLLBACK).
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

-- --- Seed de prueba (como superusuario/owner de las tablas: bypass RLS) ------
-- Dos negocios A y B; el negocio A tiene tenants en nucleo y hub.
INSERT INTO owner (id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS test · owner A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS test · owner B');

INSERT INTO owner_platform_tenant (owner_id, source_platform, platform_tenant_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'nucleo', 'rls-A-nucleo'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hub',    'rls-A-hub'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'nucleo', 'rls-B-nucleo');

-- Persona + identidad (mismo email 'e@test') en cada owner.
INSERT INTO person (id, owner_id, display_name) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A·persona'),
  ('b0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B·persona'),
  -- segunda persona de A, para el intento adversarial del caso (c)
  ('a0000000-0000-4000-8000-00000000000c', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A·persona 2');

INSERT INTO person_identity (owner_id, person_id, source_platform, id_type, id_value, id_normalized) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'nucleo', 'email', 'e@test', 'e@test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b0000000-0000-4000-8000-00000000000b', 'nucleo', 'email', 'e@test', 'e@test');

-- --- A partir de aquí, el ROL REAL de la app (sujeto a RLS) ------------------
SET LOCAL ROLE cerebro_api;
SET LOCAL app.current_owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';  -- contexto = owner A

DO $$
DECLARE
  leak_count   int;
  own_count    int;
  seen_person  uuid;
BEGIN
  -- (a) AISLAMIENTO: owner A NO ve nada de owner B.
  SELECT count(*) INTO leak_count
  FROM person_identity WHERE owner_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF leak_count <> 0 THEN
    RAISE EXCEPTION 'RLS FALLÓ (a): owner A leyó % fila(s) de owner B (debe ser 0)', leak_count;
  END IF;

  SELECT count(*) INTO own_count FROM person_identity;  -- RLS ya acota a A
  IF own_count < 1 THEN
    RAISE EXCEPTION 'RLS FALLÓ (a): owner A no ve sus propias filas (vio %)', own_count;
  END IF;

  -- (b) NO CRUCE: bajo A, 'e@test' resuelve a la persona de A (no la de B).
  SELECT person_id INTO seen_person
  FROM person_identity WHERE id_type = 'email' AND id_normalized = 'e@test';
  IF seen_person <> 'a0000000-0000-4000-8000-00000000000a' THEN
    RAISE EXCEPTION 'RLS FALLÓ (b): bajo owner A, e@test resolvió a % (esperado la persona de A)', seen_person;
  END IF;

  -- (c) EL "AJÁ"/UNIQUE: un segundo evento (hub) del MISMO owner y email NO puede
  -- crear otra identidad -> el resolver cae en la existente (misma person).
  BEGIN
    INSERT INTO person_identity (owner_id, person_id, source_platform, id_type, id_value, id_normalized)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000c', 'hub', 'email', 'e@test', 'e@test');
    RAISE EXCEPTION 'RLS/UNIQUE FALLÓ (c): se permitió una 2a identidad para (owner A, email, e@test)';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;  -- esperado: la unicidad por (owner_id, id_type, id_normalized) fuerza una sola persona
  END;

  RAISE NOTICE 'RLS OK · (a) aislamiento leak=% own=% · (b) e@test->A · (c) unique fuerza unificación', leak_count, own_count;
END $$;

RESET ROLE;
ROLLBACK;  -- descarta los datos de prueba.
