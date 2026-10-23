#!/usr/bin/env bash
# =====================================================================
# SENTINEL — Orquestador Pre-Push (universal)
# =====================================================================
# Audita el estado de la rama antes que cualquier commit salga a origin.
# Si cualquier bloque falla → push abortado con mensaje claro.
#
# Diseñado para no ser bypasseable por el agente constructor.
# Único override: $SENTINEL_SKIP=1 + commit message [sentinel-override:<razón>].
#
# Configuración por plataforma: scripts/sentinel.config.sh (único editable).
# =====================================================================
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Cargar configuración de la plataforma
if [ -f "scripts/sentinel.config.sh" ]; then
  # shellcheck disable=SC1091
  source "scripts/sentinel.config.sh"
else
  echo "✗ falta scripts/sentinel.config.sh — el Sentinel no sabe de qué plataforma es"
  exit 1
fi

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'

FAILED=0
BLOCK_RESULTS=()

# --- Override de emergencia (solo con firma del auditor en el commit) ---
if [ "${SENTINEL_SKIP:-0}" = "1" ]; then
  MSG=$(git log -1 --format=%B)
  if echo "$MSG" | grep -qE '\[sentinel-override:[^]]+\]'; then
    echo "${YELLOW}⚠ SENTINEL omitido por override del auditor:${NC}"
    echo "$MSG" | grep -oE '\[sentinel-override:[^]]+\]'
    exit 0
  else
    echo "${RED}✗ SENTINEL_SKIP=1 requiere [sentinel-override:<razón>] en el commit. Abortado.${NC}"
    exit 1
  fi
fi

run_block() {
  local name="$1"; local script="$2"
  echo ""; echo "━━━ Bloque: ${name} ━━━"
  if bash "${script}"; then
    echo "${GREEN}✓ ${name}: OK${NC}"; BLOCK_RESULTS+=("OK ${name}")
  else
    echo "${RED}✗ ${name}: FALLÓ${NC}"; BLOCK_RESULTS+=("FAIL ${name}"); FAILED=1
  fi
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  SENTINEL — Verificación pre-push grado bancario"
echo "║  Plataforma: ${SENTINEL_PLATFORM}"
echo "║  Rama: $(git rev-parse --abbrev-ref HEAD) · Commit: $(git rev-parse --short HEAD)"
echo "╚══════════════════════════════════════════════════════════════╝"

run_block "A — Gates oficiales"             "scripts/sentinel/check-gates.sh"
run_block "B — Confidencialidad docs-hub"   "scripts/sentinel/check-confidentiality.sh"
run_block "C — Guards de seguridad"         "scripts/sentinel/check-security-guards.sh"
run_block "D — Referencias a DB"            "scripts/sentinel/check-db-refs.sh"
run_block "E — Dynamic imports cross-layer" "scripts/sentinel/check-dynamic-imports.sh"
run_block "F — Sync de docs ≤${SENTINEL_MAX_COMMITS_WITHOUT_SYNC} commits" "scripts/sentinel/check-docs-sync.sh"
run_block "G — Scan de secretos"            "scripts/sentinel/check-secrets.sh"

bash scripts/sentinel/report-generator.sh "${BLOCK_RESULTS[@]}" || true

echo ""
echo "══════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo "${GREEN}✓ SENTINEL: todos los bloques OK — push autorizado${NC}"
  exit 0
else
  echo "${RED}✗ SENTINEL: push BLOQUEADO${NC}"; echo ""
  echo "Resumen:"; for r in "${BLOCK_RESULTS[@]}"; do echo "  $r"; done
  echo ""
  echo "Para desbloquear: resolver los hallazgos arriba y reintentar."
  echo "No se salta con --no-verify (CI corre lo mismo; la rama no mergea sin que pase)."
  exit 1
fi
