#!/usr/bin/env bash
# Bloque A: corre los gates oficiales definidos en sentinel.config.sh.
# Un gate que apunta a script inexistente falla con exit 127 — intencional.
set -uo pipefail
source "$(git rev-parse --show-toplevel)/scripts/sentinel.config.sh"

FAIL=0
if [ "${#SENTINEL_GATES[@]}" -eq 0 ]; then
  echo "  ⚠ no hay gates configurados en sentinel.config.sh (set vacío)"
  exit 0
fi

for g in "${SENTINEL_GATES[@]}"; do
  name="${g%%|*}"; cmd="${g#*|}"
  log=$(mktemp)
  if eval "$cmd" > "$log" 2>&1; then
    echo "  ✓ ${name}"
  else
    code=$?
    echo "  ✗ ${name} (exit ${code})"
    tail -10 "$log" | sed 's/^/      /'
    FAIL=1
  fi
  rm -f "$log"
done
exit $FAIL
