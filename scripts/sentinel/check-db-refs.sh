#!/usr/bin/env bash
# Bloque D: columnas referenciadas en queries PostgREST deben existir en migraciones.
set -uo pipefail
source "$(git rev-parse --show-toplevel)/scripts/sentinel.config.sh"

FAIL=0
MIG_DIR="${SENTINEL_MIGRATIONS_DIR}"

# Si no hay carpeta de migraciones todavía, no hay nada que validar.
if [ ! -d "$MIG_DIR" ] || ! ls "$MIG_DIR"/*.sql >/dev/null 2>&1; then
  echo "  ⚠ sin migraciones en ${MIG_DIR} — nada que validar (repo temprano)"
  exit 0
fi

QUERIES=$(grep -rhoE '\$\{[^}]+\}/[a-z_]+\?[^"]+' src/ 2>/dev/null | sort -u)
for q in $QUERIES; do
  table=$(echo "$q" | sed -E 's|.*\}/([a-z_]+)\?.*|\1|'); [ -z "$table" ] && continue
  cols=$(echo "$q" | grep -oE '[?&][a-z_]+=eq\.' | sed -E 's/[?&]([a-z_]+)=eq\./\1/' | grep -vE '^(select|limit|order|offset)$' || true)
  for c in $cols; do
    if ! grep -qE "\b${c}\b" "$MIG_DIR"/*.sql 2>/dev/null; then
      echo "  ✗ query a columna inexistente: tabla=${table} columna=${c}"; FAIL=1
    fi
  done
done

[ $FAIL -eq 0 ] && echo "  ✓ todas las columnas referenciadas existen en migraciones"
exit $FAIL
