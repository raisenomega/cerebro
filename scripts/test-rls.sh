#!/usr/bin/env bash
# Corre el test adversarial de RLS contra un Postgres con la migración 001
# aplicada. NO está en los gates del Sentinel porque requiere una DB (CI no la
# tiene aún). Uso:
#   DATABASE_URL="postgres://…/cerebro" bash scripts/test-rls.sh
set -eu

: "${DATABASE_URL:?DATABASE_URL requerido (Postgres con la migración 001 aplicada)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/rls_person_identity.sql"
