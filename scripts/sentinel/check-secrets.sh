#!/usr/bin/env bash
# Bloque G: scan de secretos reales en los archivos del commit a pushear.
# Patrones base + SENTINEL_EXTRA_SECRET_PATTERNS del config (Voyage, Anthropic...).
set -uo pipefail
source "$(git rev-parse --show-toplevel)/scripts/sentinel.config.sh"

FAIL=0
FILES=$(sentinel_changed_files | grep -vE '\.(lock|png|jpg|jpeg|svg|pdf|woff2?)$' || true)
if [ -z "$FILES" ]; then
  echo "  ✓ sin archivos para escanear"
  exit 0
fi

# Patrones base (comunes a todo el ecosistema)
PATTERNS=(
  'BEGIN (RSA |EC |DSA |)PRIVATE KEY'
  'EAAG[A-Za-z0-9]{20,}'                 # Meta long-lived token
  'xoxb-[A-Za-z0-9-]{10,}'               # Slack bot token
  'ghp_[A-Za-z0-9]{30,}'                 # GitHub personal token
  'sk_live_[A-Za-z0-9]{20,}'             # Stripe live
  'rk_live_[A-Za-z0-9]{20,}'             # Stripe restricted
  'AIza[A-Za-z0-9_-]{30,}'               # Google API
  'aws_secret_access_key\s*=\s*[A-Za-z0-9/+]{40}'
  'META_APP_SECRET\s*=\s*["\x27]?[a-f0-9]{30,}'
)
# Patrones extra del config (Voyage 'pa-', Anthropic 'sk-ant-', etc.)
if [ "${#SENTINEL_EXTRA_SECRET_PATTERNS[@]}" -gt 0 ]; then
  PATTERNS+=("${SENTINEL_EXTRA_SECRET_PATTERNS[@]}")
fi

for f in $FILES; do
  [ ! -f "$f" ] && continue
  # El .env.example puede tener placeholders; se ignora solo si NO tiene valor real.
  for p in "${PATTERNS[@]}"; do
    if grep -qE "$p" "$f" 2>/dev/null; then
      echo "  ✗ posible secreto en: $f"
      echo "      patrón: $p"
      FAIL=1
    fi
  done
done

[ $FAIL -eq 0 ] && echo "  ✓ ningún secreto conocido detectado (incl. Voyage/Anthropic)"
exit $FAIL
