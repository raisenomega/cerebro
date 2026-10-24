-- =====================================================================
-- CEREBRO · Migración 003 — Scope de visibilidad por agente (Slice 3)
-- =====================================================================
-- Qué visibilidades ve cada agente al hacer retrieve. CEREBRO es dueño de este
-- concepto (no existe en HUB/OMEGA). Fuente: CEREBRO_Alineacion_Plataformas.md §3
-- + decisión del owner (2026-10-23): cada agente consulta con su propio slug
-- (least-privilege), ya no "solo Victor".
--
-- Fail-closed: un agente SIN filas aquí no ve nada (el retrieve devuelve vacío),
-- estilo honest-None de OMEGA (desconocido -> denegar, nunca adivinar).
-- Rollback: rollback/003_agent_scope.down.sql
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS agent_scope (
  agent_code text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public','internal','financial','pii_sensitive')),
  PRIMARY KEY (agent_code, visibility)
);

-- Config del ecosistema (no owner-scoped): lectura abierta, escritura service_role.
ALTER TABLE agent_scope ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_scope_read_all ON agent_scope;
CREATE POLICY agent_scope_read_all ON agent_scope FOR SELECT USING (true);
GRANT SELECT ON agent_scope TO cerebro_api;

-- Seed (§3): techos acumulativos. Mantener en sync con in-memory-scope.ts (SCOPE_SEED).
INSERT INTO agent_scope (agent_code, visibility) VALUES
  ('victor', 'public'), ('victor', 'internal'), ('victor', 'financial'), ('victor', 'pii_sensitive'),
  ('zahra',  'public'), ('zahra',  'internal'), ('zahra',  'financial'),
  ('kelsy',  'public'), ('kelsy',  'internal'), ('kelsy',  'financial'),
  ('thao',   'public'), ('thao',   'internal'),
  ('iris',   'public'), ('iris',   'internal'),
  ('eco',    'public'), ('eco',    'internal'),
  ('angel',  'public'), ('angel',  'internal'), ('angel',  'pii_sensitive')
ON CONFLICT (agent_code, visibility) DO NOTHING;

COMMIT;
