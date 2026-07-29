# Monitoring Guide — Auvora Wallet

**Task:** 036  
**Related:** [`PRODUCTION_READINESS_OBSERVABILITY.md`](./PRODUCTION_READINESS_OBSERVABILITY.md), ADR 0008

---

## Pillars

| Pillar                 | Implementation                                             |
| ---------------------- | ---------------------------------------------------------- |
| Application monitoring | Nest health/ready, Next `/api/health`                      |
| Performance            | OTEL traces/metrics; gateway load suite                    |
| Error tracking         | Structured Pino errors + observability service             |
| Audit logs             | Auth/compliance/custody domain audit tables + streams      |
| Metrics                | `/metrics/resilience` (internal key), OTLP export          |
| Health checks          | `/health` liveness, `/ready` dependency probes             |
| Alerting               | Wire Alertmanager / cloud alarms to on-call (staging→prod) |

## Local collector

```bash
docker compose -f infrastructure/monitoring/docker-compose.monitoring.yml up -d
# OTLP: localhost:4317 (gRPC) / 4318 (HTTP)
```

## Structured logging

All Nest services use Pino. Separate by `service` / `component` fields:

| Stream      | Fields / source                                           |
| ----------- | --------------------------------------------------------- |
| Application | `service`, `msg`, request handlers                        |
| API / edge  | Gateway access logs + `x-request-id` / `x-correlation-id` |
| Security    | Auth failures, lockouts, CSRF rejects (no secrets)        |
| Worker      | Worker class name, job id, retries                        |
| Audit       | Append-only domain audit events                           |

Redact tokens via `@auvora/security` helpers. Never log JWTs, refresh tokens, or mnemonic material.

## Recommended alerts (production)

| Alert           | Condition                          |
| --------------- | ---------------------------------- |
| GatewayDown     | `/health` failing 2m               |
| AuthDegraded    | `/ready` 503 sustained 5m          |
| HighErrorRate   | 5xx > 2% for 5m on gateway         |
| DBConnections   | pool saturation > 80%              |
| BackupJobFailed | CronJob not Succeeded              |
| CertExpiring    | cert-manager Ready=False           |
| QueueLag        | notification/worker lag beyond SLO |

## Dashboards

- Platform status UI: `https://status.example.com` (web `/status`)
- Admin observability: `https://admin.example.com/observability`
- Export OTLP → your APM (Datadog / Grafana Cloud / etc.)

## Workers & queues

Workers are env-gated (`*_WORKERS_ENABLED`). Monitor:

- Queue depth / failed jobs (notifications)
- Sync intervals (wallet, market-data, bridge)
- Dead-letter / retry counters where implemented

## Security monitoring

- Rate-limit spikes
- Lockout events
- Internal API key misuse on `/metrics/resilience`
- CSP Report-Only violation endpoints (when report URI configured at edge)
