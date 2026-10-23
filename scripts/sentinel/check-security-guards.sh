#!/usr/bin/env bash
# Bloque C: detecta verificaciones de seguridad opcionales (bypasseables).
# Patrón: if (sig/token/csrf/hmac/...) que envuelve una verificación.
set -uo pipefail

FAIL=0
BAD=$(grep -rnE 'if\s*\(\s*(sig|signature|token|verifier|csrf|hmac|state|firma)\s*\)' \
  src/ 2>/dev/null \
  | grep -vE '\.test\.ts|_test\.ts|__tests__' \
  | grep -vE '//.*(sentinel-allow|intentional)' \
  || true)

if [ -n "$BAD" ]; then
  echo "  ✗ verificación de seguridad opcional detectada:"
  echo "$BAD" | sed 's/^/      /'
  echo ""
  echo "    En bank-grade, los controles de seguridad son MANDATORIOS."
  echo "    Un 'if (sig)' permite bypass omitiendo el parámetro."
  echo "    Correcto: if (!sig) return err({ kind: 'firma_requerida' });"
  echo "    Si es intencional: // sentinel-allow: <razón>"
  FAIL=1
else
  echo "  ✓ ninguna verificación de seguridad opcional detectada"
fi
exit $FAIL
