-- =====================================================================
-- CEREBRO · Migración 001 — Identidad + registro de plataformas (Slice 1)
-- =====================================================================
-- Fuente de verdad del esquema: docs-hub/RAISEN_Cerebro_Unico_Arquitectura.md §4-5.
-- Rollback: rollback/001_identity_platform.down.sql
--
-- NOTA DE DISEÑO — RLS / "tenant" (para el auditor):
--   El §5 define person_identity SIN columna tenant_id (a diferencia de
--   knowledge_chunk del §6.1, que sí la lleva). El aislamiento multi-tenant de
--   este slice se ancla en `source_platform`: la plataforma que AFIRMA una
--   identidad es el límite de lectura. El resolver/ingester corre como
--   service_role (BYPASSRLS) para poder UNIFICAR identidades entre plataformas
--   (ese es el punto del cerebro: mismo email en NÚCLEO y HUB => misma person).
--   La tensión §2.1 (tenant_id en cada tabla) vs §5 (exacto, sin tenant_id en
--   identidad) queda señalada para que el owner/auditor la confirme antes del
--   Slice 2. Si se decide tenant_id en identidad, entra en una migración 00X.
-- =====================================================================

BEGIN;

-- pgvector: CEREBRO es una DB con vectores desde el día 1 (arquitectura §6).
-- Se habilita en 001 aunque las columnas vector llegan en el Slice 2.
CREATE EXTENSION IF NOT EXISTS vector;

-- --- Registro de plataformas (§4) — arquitectura abierta, NO enum cerrado ---
CREATE TABLE IF NOT EXISTS platform (
  id            text PRIMARY KEY,                 -- 'nucleo','omega','hub',… 'x'
  name          text NOT NULL,
  sector        text,
  is_active     boolean NOT NULL DEFAULT true,
  registered_at timestamptz NOT NULL DEFAULT now()
);

-- --- Persona unificada (§5) ---
CREATE TABLE IF NOT EXISTS person (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  merged_into  uuid REFERENCES person(id)         -- fusiones de duplicados
);

-- --- Identidad por plataforma (§5) ---
CREATE TABLE IF NOT EXISTS person_identity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  source_platform text NOT NULL REFERENCES platform(id),   -- abierto, no hardcodeado
  id_type         text NOT NULL CHECK (id_type IN ('local_id','email','phone','social_handle')),
  id_value        text NOT NULL,
  id_normalized   text NOT NULL,                  -- email lowercase / phone E.164 / handle sin @
  confidence      numeric NOT NULL DEFAULT 1.0,   -- 1.0 = match determinístico
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_platform, id_type, id_normalized)
);

-- Índice de lookup del resolver (§5): búsqueda cross-plataforma por (tipo, normalizado).
CREATE INDEX IF NOT EXISTS idx_person_identity_lookup ON person_identity (id_type, id_normalized);
-- Apoyos: lookups por persona y resolución de la cadena de merge.
CREATE INDEX IF NOT EXISTS idx_person_identity_person ON person_identity (person_id);
CREATE INDEX IF NOT EXISTS idx_person_merged_into ON person (merged_into) WHERE merged_into IS NOT NULL;

-- --- RLS: aislamiento por plataforma -------------------------------------
-- Helper: plataforma del scope de la sesión actual.
--   * Supabase: claim 'platform' del JWT (request.jwt.claims).
--   * Sesión directa / tests: GUC `cerebro.platform` (SET cerebro.platform = '…').
-- STABLE y sin efectos; solo lee settings de la sesión.
CREATE OR REPLACE FUNCTION cerebro_current_platform() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('cerebro.platform', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'platform'
  );
$$;

ALTER TABLE platform        ENABLE ROW LEVEL SECURITY;
ALTER TABLE person          ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_identity ENABLE ROW LEVEL SECURITY;

-- platform: registro compartido — lectura para cualquier sesión;
-- escritura solo service_role (BYPASSRLS, no necesita policy).
DROP POLICY IF EXISTS platform_read_all ON platform;
CREATE POLICY platform_read_all ON platform
  FOR SELECT USING (true);

-- person_identity: una plataforma SOLO ve SUS propias filas.
-- El resolver (service_role) las ve todas para unificar cross-plataforma.
DROP POLICY IF EXISTS person_identity_read_own_platform ON person_identity;
CREATE POLICY person_identity_read_own_platform ON person_identity
  FOR SELECT USING (source_platform = cerebro_current_platform());

-- person: una plataforma ve una persona solo si tiene una identidad suya enlazada.
DROP POLICY IF EXISTS person_read_if_linked ON person;
CREATE POLICY person_read_if_linked ON person
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM person_identity pi
      WHERE pi.person_id = person.id
        AND pi.source_platform = cerebro_current_platform()
    )
  );

-- Sin políticas INSERT/UPDATE/DELETE para roles con RLS => escritura denegada
-- salvo service_role (BYPASSRLS), que es quien corre el resolver/ingester.

-- --- Seed de plataformas v1 (§11): nucleo, omega, hub --------------------
INSERT INTO platform (id, name, sector) VALUES
  ('nucleo', 'NÚCLEO by Raisen', 'erp'),
  ('omega',  'OMEGA by Raisen',  'marketing'),
  ('hub',    'HUB by Raisen',    'conversational')
ON CONFLICT (id) DO NOTHING;

COMMIT;
