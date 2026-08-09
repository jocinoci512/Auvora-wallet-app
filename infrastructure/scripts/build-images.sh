#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${REGISTRY:-auvora}"
TAG="${TAG:-latest}"
DOCKERFILE="${ROOT}/infrastructure/docker/Dockerfile.service"

# name:port — Closed Beta first, then deferred Nest services
SERVICES=(
  gateway:4000
  auth:4001
  wallet:3002
  blockchain:3003
  connections:3016
  market-data:3012
  payments:3004
  compliance:3005
  notifications:3006
  analytics:3007
  ai:3008
  custody:3009
  observability:3010
  swap:3013
  nft:3014
  staking:3015
  bridge:3017
)

APPS=(web admin)

echo "==> Building NestJS service images (${REGISTRY}/*:${TAG})"
for entry in "${SERVICES[@]}"; do
  svc="${entry%%:*}"
  port="${entry##*:}"
  image="${REGISTRY}/${svc}-service:${TAG}"
  echo "    ${image} (SERVICE=${svc} PORT=${port})"
  docker build \
    -f "${DOCKERFILE}" \
    --build-arg "SERVICE=${svc}" \
    --build-arg "PORT=${port}" \
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
