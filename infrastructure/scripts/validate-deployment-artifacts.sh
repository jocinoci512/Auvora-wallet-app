#!/usr/bin/env bash
# Validate deployment artifacts (Helm + Terraform) using local CLIs or Docker fallbacks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHART="$ROOT/infrastructure/helm/auvora-wallet"
TF_DIR="$ROOT/infrastructure/terraform"
FAILED=0

run_helm() {
  if command -v helm >/dev/null 2>&1; then
    helm "$@"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm -v "$ROOT:/work" -w /work alpine/helm:3.16.3 "$@"
  else
    echo "ERROR: neither helm nor docker available" >&2
    return 127
  fi
}

run_terraform() {
  if command -v terraform >/dev/null 2>&1; then
    (cd "$TF_DIR" && terraform "$@")
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm -v "$TF_DIR:/work" -w /work hashicorp/terraform:1.9.8 "$@"
  else
    echo "ERROR: neither terraform nor docker available" >&2
    return 127
  fi
}

echo "==> Helm lint (all env values)"
run_helm lint "$CHART" || FAILED=1
for env in local development qa testing staging production disaster-recovery; do
  echo "---- values-$env.yaml"
  run_helm lint "$CHART" -f "$CHART/values-$env.yaml" || FAILED=1
done

echo "==> Helm template (strategy matrix)"
for strategy in rolling blue-green canary; do
  echo "---- strategy=$strategy"
  out=$(mktemp)
  run_helm template "auvora-$strategy" "$CHART" \
    -f "$CHART/values-production.yaml" \
    --set "global.deploymentStrategy=$strategy" \
    --set "global.blueGreen.slot=green" \
    --set "global.blueGreen.activeSlot=blue" \
    --namespace auvora-production >"$out" || FAILED=1
  if [[ ! -s "$out" ]]; then
    echo "ERROR: empty template for $strategy" >&2
    FAILED=1
  fi
  # Every Nest service + apps must appear
  for svc in gateway auth wallet blockchain payments compliance notifications analytics ai custody observability web admin; do
    if ! grep -q "app.kubernetes.io/service: $svc" "$out"; then
      echo "ERROR: missing service label for $svc in $strategy render" >&2
      FAILED=1
    fi
  done
  if ! grep -q "runAsNonRoot: true" "$out"; then
    echo "ERROR: runAsNonRoot missing in $strategy render" >&2
    FAILED=1
  fi
  if ! grep -q "livenessProbe:" "$out"; then
    echo "ERROR: livenessProbe missing in $strategy render" >&2
    FAILED=1
  fi
  if ! grep -q "readinessProbe:" "$out"; then
    echo "ERROR: readinessProbe missing in $strategy render" >&2
    FAILED=1
  fi
  if ! grep -q "startupProbe:" "$out"; then
    echo "ERROR: startupProbe missing in $strategy render" >&2
    FAILED=1
  fi
  if grep -qiE 'password:.*(prod|live|real)|sk_live|BEGIN RSA PRIVATE KEY' "$out"; then
    echo "ERROR: suspicious secret material in rendered manifests" >&2
    FAILED=1
  fi
  rm -f "$out"
done

echo "==> Helm unittest (if plugin available)"
if run_helm plugin list 2>/dev/null | grep -q unittest; then
  run_helm unittest "$CHART" || FAILED=1
else
  echo "helm-unittest plugin not installed — skipped (CI installs it)"
fi

echo "==> Terraform fmt/validate"
run_terraform fmt -check -recursive || FAILED=1
run_terraform init -backend=false -input=false || FAILED=1
run_terraform validate || FAILED=1

echo "==> Secret hygiene (no chart create in production values)"
if grep -qE '^[[:space:]]*create:[[:space:]]*true' "$CHART/values-production.yaml"; then
  # Narrow: only fail if secrets.create is true (block under secrets:)
  if awk '/^secrets:/{s=1} s&&/^[^ #]/{if($0 !~ /^secrets:/ && $0 !~ /^ /) s=0} s&&/create:[[:space:]]*true/{found=1} END{exit !found}' "$CHART/values-production.yaml"; then
    echo "ERROR: production values must not create inline Secrets" >&2
    FAILED=1
  fi
fi
if grep -qiE 'CHANGE_ME|sk_live|AKIA[0-9A-Z]{16}' "$CHART/values-production.yaml" "$CHART/values.yaml"; then
  echo "ERROR: placeholder/production-looking secrets in committed values" >&2
  FAILED=1
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "Deployment artifact validation FAILED"
  exit 1
fi
echo "Deployment artifact validation PASSED"
