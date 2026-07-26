# Auvora Wallet — Helm

Umbrella chart at `auvora-wallet/` deploys all NestJS services, web/admin apps, and optional Postgres/Redis.

## Prerequisites

- Kubernetes 1.26+
- Helm 3.12+
- Ingress controller (nginx recommended)

## Install

```bash
# Production
helm upgrade --install auvora-wallet ./auvora-wallet \
  -f ./auvora-wallet/values.yaml \
  -f ./auvora-wallet/values-production.yaml \
  -n auvora-production --create-namespace

# Local (with in-cluster Postgres + Redis)
helm upgrade --install auvora-wallet ./auvora-wallet \
  -f ./auvora-wallet/values.yaml \
  -f ./auvora-wallet/values-local.yaml \
  -n auvora-local --create-namespace
```

## Upgrade

```bash
helm upgrade auvora-wallet ./auvora-wallet \
  -f ./auvora-wallet/values.yaml \
  -f ./auvora-wallet/values-staging.yaml \
  -n auvora-staging
```

## Rollback

```bash
helm history auvora-wallet -n auvora-production
helm rollback auvora-wallet <revision> -n auvora-production
```

## Lint

```bash
bash ../scripts/helm-lint.sh
```

## Windows notes

Use Git Bash or WSL for shell scripts. Helm itself runs natively in PowerShell:

```powershell
helm lint .\auvora-wallet -f .\auvora-wallet\values.yaml
helm template auvora-wallet .\auvora-wallet -f .\auvora-wallet\values-local.yaml
```

## Secrets

Non-local environments use **External Secrets** (`secrets.externalSecret.enabled=true`, `secrets.create=false`).

Local only may set `secrets.create=true` with non-production placeholder data in `values-local.yaml`.

```bash
# Prefer External Secrets / existing Secret — do not --set raw credentials in CI logs
helm upgrade auvora-wallet ./auvora-wallet \
  --set secrets.create=false \
  --set secrets.existingSecretName=auvora-app-secrets \
  -n auvora-production
```

Runtime apps may also resolve secrets via `@auvora/secrets` (env / k8s / vault / cloud SM).

## Deployment strategies

```bash
--set global.deploymentStrategy=rolling
--set global.deploymentStrategy=blue-green --set global.blueGreen.slot=green --set global.blueGreen.activeSlot=blue
--set global.deploymentStrategy=canary --set global.canary.replicas=1
```

## Services

| Service        | Port | Package                    |
|----------------|------|----------------------------|
| gateway        | 4000 | @auvora/gateway-service    |
| auth           | 4001 | @auvora/auth-service       |
| wallet         | 3002 | @auvora/wallet-service     |
| blockchain     | 3003 | @auvora/blockchain-service |
| payments       | 3004 | @auvora/payments-service   |
| compliance     | 3005 | @auvora/compliance-service |
| notifications  | 3006 | @auvora/notifications-service |
| analytics      | 3007 | @auvora/analytics-service  |
| ai             | 3008 | @auvora/ai-service         |
| custody        | 3009 | @auvora/custody-service    |
| observability  | 3010 | @auvora/observability-service |
| web            | 3000 | (app)                      |
| admin          | 3001 | (app)                      |
