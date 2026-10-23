#!/usr/bin/env bash
# =====================================================================
# SENTINEL — Configuración de CEREBRO
# =====================================================================
# Único archivo editable del Sentinel. Valores reales del repo cerebro.
# A medida que CEREBRO crezca (más gates, tests), se activan líneas aquí.
# =====================================================================

# --- Identidad de la plataforma ---
export SENTINEL_PLATFORM="CEREBRO"
export SENTINEL_BASE_BRANCH="origin/develop"

# --- Bloque A: gates oficiales ---
# CEREBRO arranca en Slice 0 (solo el paquete de contratos TS). Empieza con
# typecheck + lint; activar el resto conforme se construyan los scripts.
export SENTINEL_GATES=(
  "typecheck|pnpm run typecheck"           # corre pnpm -r typecheck (todos los paquetes, strict)
  "lint|pnpm run lint"                     # placeholder hasta Slice 1 (exit 0)
  # "check:lines|pnpm run check:lines"       # cuando exista scripts/check-lines.sh
  # "check:layers|pnpm run check:layers"     # cuando exista scripts/check-layers.sh
  # "test:unit|pnpm run test:unit"           # cuando haya tests
  # "test:integration|pnpm exec vitest run tests/integration/"
  # "adversarial|bash scripts/test-gates.sh" # tests adversariales de RLS por tenant
)

# --- Bloque B: confidencialidad ---
# Solo estos .md pueden vivir en la raíz del repo público. Todo doc interno
# (brief, arquitectura, estándares) vive en /docs-hub/ (gitignored).
export SENTINEL_ALLOWED_ROOT_MDS="^(README|SETUP|CHANGELOG)$"

# --- Bloque D: referencias a DB ---
export SENTINEL_MIGRATIONS_DIR="supabase/migrations"

# --- Bloque F: sync de documentación ---
export SENTINEL_STATE_DOC="docs-hub/current-state.md"
export SENTINEL_MAX_COMMITS_WITHOUT_SYNC=5

# --- Bloque G: scan de secretos ---
# Las credenciales que CEREBRO maneja, según el brief §2.1: Voyage, Anthropic, Stripe.
# TODAS van al Vault, NUNCA al código. Estos patrones las atrapan si se filtran.
export SENTINEL_EXTRA_SECRET_PATTERNS=(
  'pa-[A-Za-z0-9_-]{20,}'                 # Voyage AI API key (voyage-3-large)
  'sk-ant-[A-Za-z0-9_-]{20,}'             # Anthropic API key
  'sk_live_[A-Za-z0-9]{20,}'              # Stripe live (ya en base, reforzado)
  'service_role.*eyJ[A-Za-z0-9_-]{30,}'   # Supabase service_role JWT
)

# --- Helper compartido: lista de archivos del diff ---
# Si origin/develop no existe aún (repo nuevo en Slice 0) cae a TODO lo
# rastreado — nunca a "nada", que dejaría pasar un secreto en un repo joven.
sentinel_changed_files() {
  local mb
  mb="$(git merge-base HEAD "${SENTINEL_BASE_BRANCH}" 2>/dev/null || true)"
  if [ -n "$mb" ]; then
    git diff --name-only "$mb"..HEAD 2>/dev/null || true
  else
    git ls-files 2>/dev/null || true
  fi
}
