#!/usr/bin/env bash
# Genera reporte markdown del Sentinel para el auditor.
# Reporte → .sentinel-reports/<branch>-<timestamp>.md (gitignored)
set -uo pipefail
source "$(git rev-parse --show-toplevel)/scripts/sentinel.config.sh"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)
STAMP=$(date +%Y%m%d-%H%M%S)
MB="$(git merge-base HEAD "${SENTINEL_BASE_BRANCH}" 2>/dev/null || true)"
OUT_DIR=".sentinel-reports"; mkdir -p "$OUT_DIR"
OUT="${OUT_DIR}/${BRANCH//\//_}-${STAMP}-${COMMIT}.md"

{
  echo "# Sentinel Report — ${SENTINEL_PLATFORM} — ${BRANCH}"
  echo ""
  echo "- **Commit**: ${COMMIT}"
  echo "- **Timestamp**: $(date -Iseconds)"
  echo "- **Autor commit**: $(git log -1 --format=%an)"
  echo ""
  echo "## Resumen bloques"
  echo ""
  for r in "$@"; do echo "- $r"; done
  echo ""
  echo "## Archivos cambiados"
  echo ""; echo '```'
  if [ -n "$MB" ]; then git diff --stat "$MB"..HEAD 2>/dev/null | head -50; else echo "(repo nuevo: sin base de comparación)"; fi
  echo '```'; echo ""
  echo "## Líneas por archivo"
  echo ""; echo '```'
  sentinel_changed_files \
    | grep -E '\.(ts|sql|sh)$' \
    | while read -r f; do [ -f "$f" ] && printf '%4d  %s\n' "$(wc -l < "$f")" "$f"; done \
    | sort -rn | head -20
  echo '```'; echo ""
  echo "---"
  echo "_Reporte generado por scripts/sentinel.sh — para el auditor._"
} > "$OUT"

echo ""
echo "📄 Reporte: ${OUT}"
