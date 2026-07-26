#!/usr/bin/env bash
set -euo pipefail

# Smoke health checks against deployed services.
# Usage:
#   ./smoke-health.sh                          # defaults: gateway @ localhost:4000
#   GATEWAY_URL=http://gateway:4000 ./smoke-health.sh
#   NAMESPACE=auvora-production ./smoke-health.sh --in-cluster

GATEWAY_URL="${GATEWAY_URL:-http://localhost:4000}"
TIMEOUT="${TIMEOUT:-5}"
IN_CLUSTER=false

if [[ "${1:-}" == "--in-cluster" ]]; then
  IN_CLUSTER=true
fi

check() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' --max-time "${TIMEOUT}" "${url}" || echo "000")"
  if [[ "${code}" =~ ^2[0-9][0-9]$ ]]; then
    echo "  OK  ${name} (${code}) ${url}"
  else
    echo "  FAIL ${name} (${code}) ${url}" >&2
    return 1
  fi
}

echo "==> Smoke health checks"
echo "    Gateway: ${GATEWAY_URL}"

failures=0
check "gateway /health" "${GATEWAY_URL}/health" || failures=$((failures + 1))
check "gateway /ready" "${GATEWAY_URL}/ready" || failures=$((failures + 1))

if [[ "${IN_CLUSTER}" == true ]]; then
  NAMESPACE="${NAMESPACE:-auvora-wallet}"
  services=(auth:4001 wallet:3002 blockchain:3003 payments:3004 compliance:3005 \
            notifications:3006 analytics:3007 ai:3008 custody:3009 observability:3010)
  for entry in "${services[@]}"; do
    name="${entry%%:*}"
    port="${entry##*:}"
    url="http://${name}.${NAMESPACE}.svc.cluster.local:${port}/health"
    check "${name} /health" "${url}" || failures=$((failures + 1))
  done
fi

if [[ "${failures}" -gt 0 ]]; then
  echo "==> ${failures} check(s) failed" >&2
  exit 1
fi

echo "==> All smoke checks passed"
