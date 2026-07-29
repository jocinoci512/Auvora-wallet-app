# API Audit — RC1 (Task 035)

**Date:** 2026-07-27  
**Verdict:** **API Status — Pass** (contracts + edge); live mutation certification Partial without full mesh

## Topology

Browser → **Gateway `:4000`** → Auth, Wallet, Blockchain, Payments, Compliance, Notifications, Analytics, AI, Custody, Observability, Market-data, Swap, NFT, Staking, Connections, Bridge.

Public OpenAPI: `http://localhost:4000/api/docs`  
Versioning: `/api/v1/**`

## Edge behaviors verified

| Concern                             | Status                                               |
| ----------------------------------- | ---------------------------------------------------- |
| Request proxy + timeouts            | Pass (`PROXY_TIMEOUT_MS=30000`)                      |
| Rate limiting                       | Pass (fixed window)                                  |
| Internal route deny                 | Pass                                                 |
| Security headers                    | Pass                                                 |
| CORS allow-list + credentials       | Pass                                                 |
| Health / ready / resilience metrics | Pass (`/ready` 503 when auth down)                   |
| Error responses                     | Pass (Nest exception filters + proxy status mapping) |

## Cross-cutting API qualities

| Concern       | Status | Notes                                   |
| ------------- | ------ | --------------------------------------- |
| AuthN         | Pass   | Bearer + cookies via auth               |
| AuthZ         | Pass   | Permission guards                       |
| CSRF          | Pass   | Auth + domain guards                    |
| Validation    | Pass   | DTO / Zod                               |
| Pagination    | Pass   | `take`/`cursor` patterns on list routes |
| Consistency   | Pass   | `{ data }` envelope convention (SDK)    |
| Documentation | Pass   | Swagger at gateway                      |
| Versioning    | Pass   | `/api/v1`                               |

## Contract smoke (journey)

When gateway is up: health, ready, docs, resilience metrics exercise successfully. Domain routes return 504 and are skipped when upstreams are down — expected for partial mesh.

## SDK alignment

`@auvora/sdk` client covers auth, wallets, and major domain surfaces used by web/admin.

## Gaps / GA

- Full authenticated mutation matrix on staging DB
- OpenAPI completeness for newest bridge/connections admin ops
- Public rate-limit headers (`Retry-After`) consistency audit
