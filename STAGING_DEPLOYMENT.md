# Staging Deployment — Auvora Wallet

**Task:** 038  
**Date:** 2026-07-27  
**Version:** `1.0.0-rc.1`  
**Scope:** Production-like staging configuration and local/staging validation harness (no new product features)

---

## Objective

Mirror production topology for closed-beta soak: frontend, API gateway, WebSocket-capable edge, Redis, PostgreSQL, background workers, object storage, env/secrets — with live Alchemy for chain RPC.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Helm staging values | [`infrastructure/helm/auvora-wallet/values-staging.yaml`](./infrastructure/helm/auvora-wallet/values-staging.yaml) |
| Staging env template | [`.env.staging.example`](./.env.staging.example) |
| Health smoke script | [`infrastructure/scripts/smoke-health.sh`](./infrastructure/scripts/smoke-health.sh) |
| Staging validation harness | [`scripts/staging-validate.mjs`](./scripts/staging-validate.mjs) |
| UI preview launcher | [`scripts/start-previews.ps1`](./scripts/start-previews.ps1) |

---

## Topology (staging)

| Plane | Staging target |
|-------|----------------|
| Marketing / app | `https://staging.example.com`, `https://app.staging.example.com` |
| API / WebSocket edge | `https://api.staging.example.com` → gateway `:4000` |
| Admin | `https://admin.staging.example.com` |
| Docs / status | `docs` / `status` staging hosts |
| PostgreSQL | Managed (Helm `postgres.enabled: false`) |
| Redis | Managed (Helm `redis.enabled: false`) |
| Object storage | `auvora-wallet-staging-assets` |
| Secrets | External Secrets → `auvora/staging/app` |
| Workers | Enabled (wallet, market-data, swap, nft, staking, bridge, connections, notifications) |
| Blockchain | Alchemy primary; simulator **off** |

Ingress includes TLS (cert-manager), HSTS, SSL redirect, and RPS limits. CORS and cookie domain scoped to `.staging.example.com`.

---

## Configuration checklist

| Area | Status | Notes |
|------|--------|-------|
| Frontend (web/admin) | Ready | `NEXT_PUBLIC_*` staging URLs in values + `.env.staging.example` |
| Backend services | Ready | In-cluster DNS URLs in Helm ConfigMap |
| API gateway | Ready | Rate limit + proxy timeout tuned for staging |
| WebSocket | Ready (config) | Same API host; requires live gateway + upstreams |
| Redis | Config template | Requires managed Redis URL in secrets |
| PostgreSQL | Config template | Requires managed `DATABASE_URL` |
| Background workers | Enabled in staging values | Domain simulators still on for non-chain where keys absent |
| Object storage | Bucket/region templated | Wire access keys via External Secrets |
| Environment variables | Templated | Never commit real secrets |
| Secrets management | External Secrets enabled | `create: false` for inline K8s secrets |

---

## Deploy sequence (operator)

1. Provision managed Postgres + Redis; load schema via `pnpm db:migrate` against staging DB.  
2. Populate External Secrets (`ALCHEMY_API_KEY`, JWT, SMTP, object storage, DB/Redis URLs).  
3. `helm upgrade --install auvora-wallet ./infrastructure/helm/auvora-wallet -n auvora-staging -f values-staging.yaml`.  
4. Confirm TLS certificates and DNS for staging hosts.  
5. `NAMESPACE=auvora-staging ./infrastructure/scripts/smoke-health.sh --in-cluster`.  
6. From a workstation with staging API reachable: `API_URL=https://api.staging.example.com node scripts/staging-validate.mjs`.  
7. Soak: backups CronJob (`0 3 * * *`), OTEL collector, mail path, Alchemy RPC.

---

## Local staging-like validation (this task)

Executed on the engineering host (not a full K8s cutover):

| Step | Result |
|------|--------|
| `node scripts/staging-validate.mjs` | **4/4 PASS** (`alchemy_rpc`, `resilience_sim`, `chaos_gateway`, `journey_smoke`) |
| Recommendation from harness | `staging_validation_green_continue_soak` |

Local gaps (expected without managed data plane): Postgres `:5432` and Redis `:6379` down → gateway `/ready` returns **503** (degraded-but-responding). Auth/wallet mutation journeys soft-skipped until mesh + DB are up.

---

## Related

- [`LIVE_VALIDATION_REPORT.md`](./LIVE_VALIDATION_REPORT.md)  
- [`OPERATIONAL_READINESS.md`](./OPERATIONAL_READINESS.md)  
- [`KNOWN_PRODUCTION_LIMITATIONS.md`](./KNOWN_PRODUCTION_LIMITATIONS.md)  
- [`docs/PRODUCTION_DEPLOYMENT.md`](./docs/PRODUCTION_DEPLOYMENT.md)  
