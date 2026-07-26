#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/terraform"

echo "==> Terraform init (offline modules)"
cd "${TF_DIR}"
terraform init -backend=false -input=false

echo "==> Terraform validate"
terraform validate

echo "==> Terraform validate passed"
