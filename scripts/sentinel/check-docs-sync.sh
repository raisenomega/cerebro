#!/usr/bin/env bash
# Bloque F: el doc de estado se actualiza cada ≤ N commits (config).
set -uo pipefail
source "$(git rev-parse --show-toplevel)/scripts/sentinel.config.sh"

TARGET="${SENTINEL_STATE_DOC}"
MAX_COMMITS="${SENTINEL_MAX_COMMITS_WITHOUT_SYNC}"

if [ ! -f "$TARGET" ]; then
  echo "  ⚠ ${TARGET} no existe aún — pasa esta vez, créalo pronto"
  exit 0
fi

LAST_SYNC=$(stat -c %Y "$TARGET" 2>/dev/null || stat -f %m "$TARGET" 2>/dev/null || echo 0)
COMMITS_SINCE=$(git log --since="@$LAST_SYNC" --oneline | wc -l | tr -d ' ')

if [ "$COMMITS_SINCE" -gt "$MAX_COMMITS" ]; then
  echo "  ✗ ${TARGET} desactualizado (${COMMITS_SINCE} commits desde último sync, máx ${MAX_COMMITS})"
  echo "      Actualiza: estado actual, archivos nuevos, decisiones, deuda técnica."
  exit 1
else
  echo "  ✓ ${TARGET} sincronizado (${COMMITS_SINCE}/${MAX_COMMITS} commits)"
fi
exit 0
