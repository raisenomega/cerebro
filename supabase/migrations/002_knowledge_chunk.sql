-- =====================================================================
-- CEREBRO · Migración 002 — RAG: knowledge_chunk (Slice 2)
-- =====================================================================
-- Capa RAG (Arquitectura §6.1), adaptada al modelo owner de la migración 001:
-- cada chunk pertenece a un owner (negocio) y, opcionalmente, a una person.
-- Mismo patrón de aislamiento que Slice 1: RLS fail-closed por owner.
-- Rollback: rollback/002_knowledge_chunk.down.sql
--
-- Embedding: Voyage voyage-3-large, dimensión FIJA 1024 (vector(1024)).
-- Idempotencia de ingesta: UNIQUE (owner_id, dedup_key).
-- =====================================================================

BEGIN;

-- La extensión `vector` ya existe (001); por si se aplica 002 aislada:
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunk (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES owner(id) ON DELETE CASCADE,
  person_id       uuid REFERENCES person(id) ON DELETE CASCADE,
  source_platform text NOT NULL REFERENCES platform(id),
  kind            text NOT NULL,              -- 'conversation','order_history','contact',…
  content         text NOT NULL,
  embedding       vector(1024) NOT NULL,      -- dimensión Voyage FIJA
  visibility      text NOT NULL DEFAULT 'internal'
                  CHECK (visibility IN ('public','internal','financial','pii_sensitive')),
  dedup_key       text NOT NULL,              -- hash determinístico del evento (idempotencia)
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_chunk_owner_person ON knowledge_chunk (owner_id, person_id);
-- Índice vectorial ivfflat con distancia coseno (Voyage normaliza; coseno = estándar del ecosistema).
CREATE INDEX IF NOT EXISTS idx_chunk_embedding
  ON knowledge_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS: mismo aislamiento por owner que Slice 1 (fail-closed).
ALTER TABLE knowledge_chunk ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_chunk_scope ON knowledge_chunk;
CREATE POLICY knowledge_chunk_scope ON knowledge_chunk
  FOR ALL USING (owner_id = cerebro_current_owner()) WITH CHECK (owner_id = cerebro_current_owner());

-- El rol de la app (sin BYPASSRLS) ya existe (001).
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_chunk TO cerebro_api;

COMMIT;
