# Operations Guide

**Version:** v1.0.0-rc.1

## Day-2 ownership

| Domain         | Primary surface                                       |
| -------------- | ----------------------------------------------------- |
| Edge traffic   | Gateway `:4000` — health, ready, rate limits, proxies |
| Identity       | Auth `:4001`                                          |
| Money movement | Wallet, payments, ledger                              |
| Chain          | Blockchain, custody signing                           |
| Trust          | Compliance KYC/AML/risk                               |
| Comms          | Notifications workers/queues                          |
| Intelligence   | AI, analytics                                         |
| SRE            | Observability service + Admin `/observability`        |
| Infra portal   | Admin `/infrastructure`                               |

## Health model

1. **Liveness** — `GET /health` per service (process up)
2. **Readiness** — `GET /ready` (deps: database, redis, upstreams as implemented)
3. **Platform status** — Web `/status`, Admin observability dashboards
4. **Resilience metrics** — Gateway `/metrics/resilience` (authenticated)

Degraded ready responses must not crash the edge; investigate `checks` payload.

## Logging & tracing

- Structured pino logs with correlation IDs
- Optional OTEL export (`OTEL_ENABLED`, OTLP endpoint)
- Log ingest masks secrets before persistence (observability service)

## Alerts & incidents

- Alert rules / incidents / SLOs owned by observability service (admin CRUD)
- Escalate via existing incident workflow; record recovery drills for infra

## Backups & restore

Follow [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md):

- RPO ≤ 15m / RTO ≤ 60m production targets
- Monthly restore validation; quarterly DR failover drill

## Common runbooks

See [`RUNBOOKS.md`](./RUNBOOKS.md) for concrete procedures (restart gateway, auth DB unhealthy, queue backlog, rate-limit storms).

## Local data plane

```bash
# Terminal A — Postgres + migrate + seed (keeps process alive)
node scripts/migrate-with-embedded-pg.mjs

# Terminal B — Redis (if not already running)
node scripts/start-redis.mjs

# Or Docker
docker compose up -d
```
