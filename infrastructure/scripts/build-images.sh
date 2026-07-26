#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${REGISTRY:-auvora}"
TAG="${TAG:-latest}"
DOCKERFILE="${ROOT}/infrastructure/docker/Dockerfile.service"

SERVICES=(
  gateway
  auth
  wallet
  blockchain
  payments
  compliance
  notifications
  analytics
  ai
  custody
  observability
)

APPS=(web admin)

echo "==> Building NestJS service images (${REGISTRY}/*:${TAG})"
for svc in "${SERVICES[@]}"; do
  image="${REGISTRY}/${svc}-service:${TAG}"
  echo "    ${image}"
  docker build \
    -f "${DOCKERFILE}" \
    --build-arg "SERVICE=${svc}" \
    -t "${image}" \
    "${ROOT}"
done

echo "==> Building app images"
for app in "${APPS[@]}"; do
  image="${REGISTRY}/${app}:${TAG}"
  echo "    ${image}"
  docker build \
    -f "${ROOT}/infrastructure/docker/Dockerfile.next" \
    --build-arg "APP=${app}" \
    -t "${image}" \
    "${ROOT}"
done

echo "==> Build complete"
