# Production Readiness — RC1

**Date:** 2026-07-27  
**Version:** v1.0.0-rc.1  
**Decision:** **Staging GO** · **Production GA NO-GO** until checklist below clears

## Readiness dimensions

| Dimension               | Status              | Evidence                                            |
| ----------------------- | ------------------- | --------------------------------------------------- |
| Build / lint / unit     | Pass                | turbo 35/35 lint & test; 29/29 build                |
| Integration             | Pass                | 9 `*integration*.spec.ts`                           |
| E2E (Nest health)       | Pass                | 13 packages                                         |
| UI journeys             | Pass                | 14 product routes 200 + a11y smoke                  |
| Security hardening      | Pass (CSP deferred) | SECURITY_AUDIT.md                                   |
| Performance / load      | Pass                | LOAD_TEST_RESULTS.md                                |
| API edge                | Pass                | API_AUDIT.md                                        |
| Database schema         | Pass                | DATABASE_AUDIT.md                                   |
| Monitoring hooks        | Partial             | OTEL optional; `/metrics/resilience`; web `/status` |
| Full mesh + DB smoke    | Partial             | Auth/wallet not running on RC host                  |
| Pen-test / GA checklist | Pending             | FINAL_RELEASE_CHECKLIST.md                          |

## Infrastructure checklist

| Area              | RC1                                                        |
| ----------------- | ---------------------------------------------------------- |
| Env configuration | Pass — templated + secrets banner                          |
| Migrations        | Pass — 21 folders; validate OK                             |
| Redis             | Configured; live optional                                  |
| Caching           | `@auvora/cache` + service adapters                         |
| Queues / workers  | Present (notifications, wallet, domain workers)            |
| Logging           | Pino / Nest logger; request ids                            |
| Health checks     | `/health` liveness; `/ready` readiness (503 when degraded) |
| Graceful shutdown | Gateway SIGINT/SIGTERM → close + OTEL shutdown             |
| Recovery          | Circuit metrics + retry queues (domain)                    |

## Monitoring readiness

- Application: service health + web `/status`
- Performance: load harness + First Load budgets
- Errors: Nest exception filters; observability service surfaces
- Audit logging: auth/compliance audit models
- Metrics: gateway `/metrics/resilience` (keyed)
- Alerting: observability alert APIs (staging wiring Pending)

## Error handling

- User-facing empty/offline/error states (Task 034 UI)
- API structured errors via SDK `AuvoraClientError`
- Journey soft-skip when upstreams unavailable
- Retry helpers online status / offline cache

## Code quality (this pass)

- No new features
- Safe e2e harness alignment (no AppModule DB boot for health)
- Env example hygiene
- No architecture replacement

## GA exit criteria (must all be true)

1. [ ] Staging mesh: gateway + auth + wallet + critical domains healthy with Postgres/Redis
2. [ ] Authenticated journey smoke login + wallet list **not skipped**
3. [ ] CSP report-only clean for 7 days
4. [ ] Pen-test / dependency audit signs from FINAL_RELEASE_CHECKLIST
5. [ ] Backup restore drill documented
6. [ ] HSTS only at correct TLS boundary (no double/misplaced)

## Related

- [`RELEASE_CANDIDATE_RC1.md`](./RELEASE_CANDIDATE_RC1.md)
- [`../FINAL_RELEASE_CHECKLIST.md`](../FINAL_RELEASE_CHECKLIST.md)
- [`RELEASE_CANDIDATE_v1.0.md`](./RELEASE_CANDIDATE_v1.0.md) (prior Phase 14 dossier)
