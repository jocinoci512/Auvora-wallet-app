# Operational Readiness — Staging Validation

**Task:** 038  
**Date:** 2026-07-27  
**Version:** `1.0.0-rc.1`  
**Audience:** SRE / on-call / release engineering

---

## Executive status

| Area                 | Status                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| Health endpoints     | **READY** — `/health` 200; `/ready` may 503 when deps down (by design)          |
| Logs                 | **READY** — structured Nest/Pino; request correlation in gateway                |
| Monitoring / metrics | **READY** — `/metrics/resilience`; OTEL optional via env                        |
| Background jobs      | **CONFIG READY** — workers enabled in staging Helm values                       |
| Scheduled tasks      | **CONFIG READY** — backup CronJob `0 3 * * *`                                   |
| Graceful shutdown    | **READY** — gateway SIGINT/SIGTERM close + OTEL shutdown (prior RC attestation) |
| Automatic restart    | **READY** — K8s rolling deploy + HPA (min 2 / max 8 staging)                    |

**Operational posture for closed beta soak:** **GO** once managed Postgres/Redis and External Secrets are wired.  
**Public GA:** still **HOLD** (see known limitations + public launch checklist).

---

## Health & probes

| Endpoint                       | Liveness meaning     | Staging expectation                             |
| ------------------------------ | -------------------- | ----------------------------------------------- |
| `GET /health`                  | Process up           | Always 200 when pod healthy                     |
| `GET /ready`                   | Dependencies usable  | 200 when auth/DB/mesh OK; **503** when degraded |
| Service `/health` (in-cluster) | Per-service liveness | `smoke-health.sh --in-cluster`                  |

Chaos harness treats ready **503** as acceptable degraded response (not hang / not 504+). Cluster smoke scripts that require ready **200** should only run after data plane is healthy.

---

## Observability

| Signal                | Staging wiring                                                 |
| --------------------- | -------------------------------------------------------------- |
| Logs                  | `LOG_LEVEL=info`, `NODE_ENV=production`                        |
| Traces/metrics export | `OTEL_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT` → collector |
| App status UI         | Web `/status`                                                  |
| Resilience metrics    | Gateway `/metrics/resilience` (internal key when configured)   |

---

## Workers & schedules

Enabled in `values-staging.yaml` / `.env.staging.example`:

- Wallet, market-data, swap, nft, staking, bridge, connections workers
- Notifications queue + webhook workers
- Backup CronJob (daily 03:00) — ensure `BACKUP_UPLOAD_URI` / object storage credentials for off-node retention

---

## Failure & recovery expectations

| Failure           | Expected behavior                                                        |
| ----------------- | ------------------------------------------------------------------------ |
| RPC outage        | Retries, circuit metrics, failover preference to Alchemy when configured |
| API upstream down | Gateway non-200 for proxied routes; health remains up                    |
| DB disconnect     | `/ready` 503; workers retry/backoff; no silent success on mutations      |
| Redis disconnect  | Cache/rate-limit degrade; document HA rate-limit residual                |
| WebSocket drop    | Client reconnect; session re-auth as designed                            |
| High latency      | Proxy timeout (`PROXY_TIMEOUT_MS`); resilience timeouts/bulkheads        |

Validated locally: resilience-sim + chaos-test + live Alchemy (see [`LIVE_VALIDATION_REPORT.md`](./LIVE_VALIDATION_REPORT.md)).

---

## Restart & deploy readiness

| Mechanism           | Staging                                          |
| ------------------- | ------------------------------------------------ |
| Deployment strategy | Rolling                                          |
| HPA                 | minReplicas 2, maxReplicas 8                     |
| Resources           | requests 150m/384Mi; limits 1 CPU / 1Gi          |
| Secrets rotation    | External Secrets remote key `auvora/staging/app` |
| Image tag           | `staging`                                        |

---

## Operator runbook (minimum)

1. `kubectl -n auvora-staging get pods` — all Ready.
2. `./infrastructure/scripts/smoke-health.sh` against staging API (ready 200).
3. `node scripts/staging-validate.mjs` with `API_URL` / `WEB_URL` pointing at staging.
4. Confirm backup job last success and OTEL traffic.
5. On incident: check `/ready` body, resilience metrics, Alchemy status, Postgres/Redis connectivity.

---

## Related

- [`STAGING_DEPLOYMENT.md`](./STAGING_DEPLOYMENT.md)
- [`docs/MONITORING_GUIDE.md`](./docs/MONITORING_GUIDE.md)
- [`docs/RUNBOOKS.md`](./docs/RUNBOOKS.md)
- [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md)
