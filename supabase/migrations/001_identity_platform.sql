-- =====================================================================
-- CEREBRO · Migración 001 — Identidad por NEGOCIO (owner) + plataformas (Slice 1)
-- =====================================================================
-- Fuente de verdad: docs-hub/CEREBRO_Decision_Identidad_Tenant.md (v1.0, 2026-10-23),
-- que REEMPLAZA el §5 de RAISEN_Cerebro_Unico_Arquitectura.md.
-- Rollback: rollback/001_identity_platform.down.sql
--
-- DECISIÓN DE CIMIENTO: la identidad del cliente se aísla por NEGOCIO (owner).
-- El mismo email/teléfono en dos negocios distintos son personas DISTINTAS. El
-- aislamiento vive en la BASE (RLS fail-closed), NO en el código del resolver.
-- Se conserva la unificación entre plataformas del MISMO negocio (el "ajá":
-- el cliente de NÚCLEO y de HUB del mismo owner es la misma person).
--
-- Mecánica RLS: cada request de la API traduce (source_platform, tenant_id) ->
-- owner_id (función SECURITY DEFINER) y fija `SET LOCAL app.current_owner_id`.
-- De ahí en adelante, RLS filtra TODO por owner. El resolver corre con un rol
-- SIN BYPASSRLS (cerebro_api). Tenant sin mapeo => se rechaza (no se crea nada).
-- =====================================================================

BEGIN;

-- pgvector: CEREBRO es una DB con vectores desde el día 1 (columnas en Slice 2).
CREATE EXTENSION IF NOT EXISTS vector;

-- --- Registro de plataformas (§4) — arquitectura abierta, NO enum cerrado ---
CREATE TABLE IF NOT EXISTS platform (
  id            text PRIMARY KEY,                 -- 'nucleo','omega','hub',… 'x'
  name          text NOT NULL,
  sector        text,
  is_active     boolean NOT NULL DEFAULT true,
  registered_at timestamptz NOT NULL DEFAULT now()
);

-- --- OWNER: el negocio a nivel CEREBRO (une un negocio a través de plataformas) ---
CREATE TABLE IF NOT EXISTS owner (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                       -- 'Zafacones Ramos'
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- --- MAPEO: el tenant local de cada plataforma -> un owner de CEREBRO ---
CREATE TABLE IF NOT EXISTS owner_platform_tenant (
  owner_id           uuid NOT NULL REFERENCES owner(id) ON DELETE CASCADE,
  source_platform    text NOT NULL REFERENCES platform(id),
  platform_tenant_id text NOT NULL,                -- el tenant_id tal como lo manda la plataforma
  PRIMARY KEY (source_platform, platform_tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_owner_platform_tenant_owner ON owner_platform_tenant(owner_id);

-- --- Persona unificada, scoped por owner ---
CREATE TABLE IF NOT EXISTS person (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES owner(id) ON DELETE CASCADE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  merged_into  uuid REFERENCES person(id)          -- fusiones de duplicados (mismo owner)
);
CREATE INDEX IF NOT EXISTS idx_person_owner ON person(owner_id);

-- --- Identidad por plataforma, scoped por owner ---
CREATE TABLE IF NOT EXISTS person_identity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES owner(id) ON DELETE CASCADE,
  person_id       uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  source_platform text NOT NULL REFERENCES platform(id),   -- procedencia (NO en el unique)
  id_type         text NOT NULL CHECK (id_type IN ('local_id','email','phone','social_handle')),
  id_value        text NOT NULL,
  id_normalized   text NOT NULL,                  -- email lowercase / phone E.164 / handle sin @
  confidence      numeric NOT NULL DEFAULT 1.0,   -- 1.0 = match determinístico
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id_type, id_normalized)        -- resolución scoped por owner
);
-- Índice de lookup del resolver: (owner_id, id_type, id_normalized).
CREATE INDEX IF NOT EXISTS idx_person_identity_lookup ON person_identity(owner_id, id_type, id_normalized);
CREATE INDEX IF NOT EXISTS idx_person_identity_person ON person_identity(person_id);

-- --- Contexto de owner y traducción -------------------------------------
-- Owner del scope de la sesión (lo fija la API con SET LOCAL app.current_owner_id).
-- Sin contexto => NULL => RLS no deja ver nada (fail-closed).
CREATE OR REPLACE FUNCTION cerebro_current_owner() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_owner_id', true), '')::uuid;
$$;

-- Traducción (source_platform, tenant_id) -> owner_id. ÚNICO paso privilegiado:
-- SECURITY DEFINER para leer el mapeo antes de tener contexto de owner. Devuelve
-- solo el owner_id (o NULL = tenant desconocido, que la API rechaza).
CREATE OR REPLACE FUNCTION cerebro_resolve_owner(p_source_platform text, p_platform_tenant_id text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM owner_platform_tenant
  WHERE source_platform = p_source_platform
    AND platform_tenant_id = p_platform_tenant_id;
$$;

-- --- RLS: el aislamiento vive AQUÍ (fail-closed) -------------------------
ALTER TABLE owner                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_platform_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE person                ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_identity       ENABLE ROW LEVEL SECURITY;

-- platform: registro compartido, de solo lectura para la app.
DROP POLICY IF EXISTS platform_read_all ON platform;
ALTER TABLE platform ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_read_all ON platform FOR SELECT USING (true);

DROP POLICY IF EXISTS owner_scope ON owner;
CREATE POLICY owner_scope ON owner
  FOR ALL USING (id = cerebro_current_owner()) WITH CHECK (id = cerebro_current_owner());

DROP POLICY IF EXISTS owner_platform_tenant_scope ON owner_platform_tenant;
CREATE POLICY owner_platform_tenant_scope ON owner_platform_tenant
  FOR ALL USING (owner_id = cerebro_current_owner()) WITH CHECK (owner_id = cerebro_current_owner());

DROP POLICY IF EXISTS person_scope ON person;
CREATE POLICY person_scope ON person
  FOR ALL USING (owner_id = cerebro_current_owner()) WITH CHECK (owner_id = cerebro_current_owner());

DROP POLICY IF EXISTS person_identity_scope ON person_identity;
CREATE POLICY person_identity_scope ON person_identity
  FOR ALL USING (owner_id = cerebro_current_owner()) WITH CHECK (owner_id = cerebro_current_owner());

-- --- Rol de la aplicación (SIN BYPASSRLS) --------------------------------
-- cerebro_api es un rol de grupo NOLOGIN: la seguridad NO depende del código.
-- El despliegue crea un rol de login MIEMBRO de cerebro_api (password en Vault);
-- su cadena de conexión es DATABASE_URL. NUNCA se conecta con service_role aquí.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cerebro_api') THEN
    CREATE ROLE cerebro_api NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO cerebro_api;
GRANT SELECT ON platform TO cerebro_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON owner, owner_platform_tenant, person, person_identity TO cerebro_api;
GRANT EXECUTE ON FUNCTION cerebro_current_owner() TO cerebro_api;
GRANT EXECUTE ON FUNCTION cerebro_resolve_owner(text, text) TO cerebro_api;

-- --- Seed ----------------------------------------------------------------
-- Plataformas v1 (§11).
INSERT INTO platform (id, name, sector) VALUES
  ('nucleo', 'NÚCLEO by Raisen', 'erp'),
  ('omega',  'OMEGA by Raisen',  'marketing'),
  ('hub',    'HUB by Raisen',    'conversational')
ON CONFLICT (id) DO NOTHING;

-- Owner piloto (id fijo para que el mapeo de despliegue lo referencie).
INSERT INTO owner (id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Zafacones Ramos')
ON CONFLICT (id) DO NOTHING;

-- Mapeo de tenants HUB/NÚCLEO -> owner piloto.
-- ⚠ PASO DE DESPLIEGUE: reemplazar '<tenant_id_real_*>' por los UUIDs/tenant ids
-- reales que HUB y NÚCLEO envían en sus eventos, y descomentar. Sin este mapeo,
-- los eventos de esos tenants se RECHAZAN (fail-closed) — es a propósito.
-- INSERT INTO owner_platform_tenant (owner_id, source_platform, platform_tenant_id) VALUES
--   ('11111111-1111-4111-8111-111111111111', 'hub',    '<tenant_id_real_hub>'),
--   ('11111111-1111-4111-8111-111111111111', 'nucleo', '<tenant_id_real_nucleo>')
-- ON CONFLICT (source_platform, platform_tenant_id) DO NOTHING;

COMMIT;
