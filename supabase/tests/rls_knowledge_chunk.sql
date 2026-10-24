-- =====================================================================
-- Test adversarial de RLS — knowledge_chunk (Slice 2)
-- =====================================================================
-- Verifica que un owner NO puede leer chunks de otro owner (RLS por owner).
-- (El filtrado por `visibility`/scope del agente es responsabilidad del
-- retrieve-context.handler y está cubierto por sus tests unitarios.)
--
-- Requiere la migración 001 + 002 aplicadas. Correr con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_knowledge_chunk.sql
-- Pasa => 'RLS CHUNK OK …' y sale 0. Falla => RAISE EXCEPTION. No deja residuo.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO owner (id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS chunk · owner A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS chunk · owner B');

-- Un chunk por owner (embedding dummy de 1024 dims).
INSERT INTO knowledge_chunk (owner_id, source_platform, kind, content, embedding, visibility, dedup_key) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'nucleo', 'note', 'chunk de A',
   array_fill(0.1::float8, ARRAY[1024])::vector, 'internal', 'dedup-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'nucleo', 'note', 'chunk de B',
   array_fill(0.2::float8, ARRAY[1024])::vector, 'internal', 'dedup-b');

GRANT cerebro_api TO current_user;          -- habilita SET ROLE (PG16+; revertido en ROLLBACK)
SET LOCAL ROLE cerebro_api;
SET LOCAL app.current_owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';  -- contexto = owner A

DO $$
DECLARE
  leak_count int;
  own_count  int;
BEGIN
  SELECT count(*) INTO leak_count
  FROM knowledge_chunk WHERE owner_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF leak_count <> 0 THEN
    RAISE EXCEPTION 'RLS CHUNK FALLÓ: owner A leyó % chunk(s) de owner B (debe ser 0)', leak_count;
  END IF;

  SELECT count(*) INTO own_count FROM knowledge_chunk;  -- RLS acota a A
  IF own_count < 1 THEN
    RAISE EXCEPTION 'RLS CHUNK FALLÓ: owner A no ve sus propios chunks (vio %)', own_count;
  END IF;

  RAISE NOTICE 'RLS CHUNK OK · aislamiento leak=% own=%', leak_count, own_count;
END $$;

RESET ROLE;
ROLLBACK;
