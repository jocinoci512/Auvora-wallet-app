# 06 — Scalability

## Current architecture (summary)

- Multi-service Nest backends behind API gateway.
- `packages/cache` + Redis adapters; `packages/resilience` (timeout/retry/circuit/bulkhead).
- In-process / interval workers for notifications, sync, analytics aggregation, observability alerts (`docs/BACKGROUND_WORKERS.md`).
- Infrastructure portal: environments, deployments, backups, recovery drills (ADR 0009).

## Phase 8 stance

Prefer **docs + targeted control surfaces** over microservice rewrites.

| Topic              | Guidance                                                                          |
| ------------------ | --------------------------------------------------------------------------------- |
| Horizontal scaling | Stateless services + sticky-free JWT; scale gateway and domain pods independently |
| Caching            | Use existing CacheClient; avoid new ad-hoc caches in admin UI                     |
| Queues             | Notification queue is first-class; broader Bull/SQS abstraction still optional    |
| CDN                | Static Next assets / marketing via CDN per deployment guide                       |
| Storage / backup   | Infra backup jobs + `docs/BACKUP_RECOVERY.md`                                     |
| DR                 | `docs/DISASTER_RECOVERY.md` + admin `/infrastructure/recovery`                    |

## Admin improvements supporting scale ops

- Cluster health and deployments remain under `/infrastructure`.
- Feature flags enable progressive rollout without redeploy.
- Maintenance notices coordinate customer communication during capacity events.
- Ops overview surfaces unhealthy service counts early.

## Not done (by design)

- Migrating all workers to a single job bus.
- New global CDN configuration in-repo.
- Auto-scaling policies as code (belong in cloud IaC).
