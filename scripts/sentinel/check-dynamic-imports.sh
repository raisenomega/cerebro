#!/usr/bin/env bash
# Bloque E: bloquea dynamic imports cross-layer (DDD).
# presentation !-> infrastructure, application !-> infrastructure/presentation,
# domain !-> nada externo. El dynamic import no es un workaround válido.
set -uo pipefail

FAIL=0
VIOLATIONS=$(grep -rnE '(await\s+import|require)\s*\(\s*["\x27]\.\./(infrastructure|domain|presentation|application)' \
  src/ 2>/dev/null \
  | grep -vE '\.test\.ts|_test\.ts' \
  | grep -vE '//.*sentinel-allow' \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "  ✗ dynamic import cross-layer detectado:"
  echo "$VIOLATIONS" | sed 's/^/      /'
  echo ""
  echo "    DDD prohíbe cruzar capas. El dynamic import es la misma violación."
  echo "    Mueve el archivo a la capa correcta o inyecta por constructor."
  FAIL=1
else
  echo "  ✓ ningún dynamic import cross-layer"
fi
exit $FAIL
