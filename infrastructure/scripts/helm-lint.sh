#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART="${ROOT}/helm/auvora-wallet"

echo "==> Linting Helm chart: ${CHART}"
helm lint "${CHART}" -f "${CHART}/values.yaml"

for env in local development qa testing staging production disaster-recovery; do
  values_file="${CHART}/values-${env}.yaml"
  if [[ -f "${values_file}" ]]; then
    echo "==> Template check: values-${env}.yaml"
    helm template "auvora-wallet-${env}" "${CHART}" \
      -f "${CHART}/values.yaml" \
      -f "${values_file}" \
      --namespace "auvora-${env}" \
      >/dev/null
  fi
done

echo "==> Helm lint passed"
