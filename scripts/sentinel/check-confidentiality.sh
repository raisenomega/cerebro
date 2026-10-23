#!/usr/bin/env bash
# Bloque B: protege /docs-hub/ y archivos documentales sensibles.
set -uo pipefail
source "$(git rev-parse --show-toplevel)/scripts/sentinel.config.sh"

FAIL=0
CHANGED="$(sentinel_changed_files)"

# 1) /docs-hub/ debe estar en .gitignore
if ! git check-ignore -q docs-hub/dummy 2>/dev/null && ! grep -qE '^/?docs-hub/?' .gitignore 2>/dev/null; then
  echo "  ✗ /docs-hub/ no está en .gitignore"; FAIL=1
else
  echo "  ✓ /docs-hub/ está gitignored"
fi

# 2) Ningún archivo bajo docs-hub/ en los commits a pushear
STAGED_DOCS=$(echo "$CHANGED" | grep -E '^docs-hub/' || true)
if [ -n "$STAGED_DOCS" ]; then
  echo "  ✗ archivos bajo docs-hub/ en el commit — NO deben pushearse:"
  echo "$STAGED_DOCS" | sed 's/^/      /'; FAIL=1
else
  echo "  ✓ ningún archivo docs-hub/ en commits a pushear"
fi

# 3) Ningún .md documental fuera de los permitidos (del config)
NEW_MDS=$(echo "$CHANGED" | grep -E '^[^/]+\.md$' | sed 's/\.md$//' | grep -vE "$SENTINEL_ALLOWED_ROOT_MDS" || true)
if [ -n "$NEW_MDS" ]; then
  echo "  ✗ .md documental no autorizado a nivel raíz:"
  echo "$NEW_MDS" | sed 's/$/\.md/; s/^/      /'
  echo "      (todo documento interno va a /docs-hub/)"; FAIL=1
else
  echo "  ✓ ningún .md no autorizado en raíz"
fi

exit $FAIL
