# Auvora — Railway Environment Matrix (Closed Beta)

**Date:** 2026-08-03  
**Rule:** **NAMES ONLY** — never commit or paste secret values.  
**Companion:** [`RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md`](./RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md) · [`.env.production.example`](../.env.production.example)

Prefer **Railway shared variable groups** + **service variable references** for shared secrets (`DATABASE_URL`, `REDIS_URL`, JWT/CSRF, `INTERNAL_API_KEY`).

---

## Variable groups

### A. Shared — Postgres / Redis

| Name           | Used by (Closed Beta)                              | Notes                                                           |
| -------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL` | auth, wallet, blockchain, connections, market-data | Postgres 16; TLS/`sslmode` as provider requires; pool params OK |
| `REDIS_URL`    | same                                               | Redis 7; `rediss://` if TLS                                     |

### B. Shared — crypto / mesh secrets

| Name                      | Used by                                  | Notes                      |
| ------------------------- | ---------------------------------------- | -------------------------- |
| `JWT_ACCESS_SECRET`       | auth, wallet, blockchain, connections, … | ≥32 chars                  |
| `JWT_REFRESH_SECRET`      | auth                                     | ≥32 chars                  |
| `JWT_ACCESS_TTL_SECONDS`  | auth                                     | optional override          |
| `JWT_REFRESH_TTL_SECONDS` | auth                                     | optional override          |
| `CSRF_SECRET`             | auth (+ services that validate CSRF)     | ≥32 chars                  |
| `INTERNAL_API_KEY`        | gateway + domain services                | ≥32 chars; protect metrics |

### C. Shared — runtime / observability

| Name                          | Notes                          |
| ----------------------------- | ------------------------------ |
| `NODE_ENV`                    | `production`                   |
| `LOG_LEVEL`                   | `warn`                         |
| `SERVICE_VERSION`             | optional image/tag label       |
| `OTEL_ENABLED`                | `false` unless collector ready |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | only if OTEL on                |

### D. Shared — product flags (pin false)

| Name                            | Value                                  |
| ------------------------------- | -------------------------------------- |
| `BLOCKCHAIN_SIMULATOR_ENABLED`  | `false`                                |
| `MARKET_DATA_SIMULATOR_ENABLED` | `false`                                |
| `CONNECTIONS_SIMULATOR_ENABLED` | `false`                                |
| `NFT_WORKERS_ENABLED`           | `false`                                |
| `NFT_SIMULATOR_ENABLED`         | `false`                                |
| (other `*_SIMULATOR_ENABLED`)   | `false` if those services ever enabled |

---

## Per Railway service

### gateway (PUBLIC)

| Name                                | Required           | Notes                                                   |
| ----------------------------------- | ------------------ | ------------------------------------------------------- |
| `PORT`                              | yes                | `4000`                                                  |
| `SERVICE_NAME`                      | optional           | `gateway`                                               |
| `CORS_ORIGINS`                      | yes                | `https://auvorawallet.com,https://www.auvorawallet.com` |
| `AUTH_SERVICE_URL`                  | yes                | private auth URL                                        |
| `WALLET_SERVICE_URL`                | yes                | private                                                 |
| `BLOCKCHAIN_SERVICE_URL`            | yes                | private                                                 |
| `CONNECTIONS_SERVICE_URL`           | yes                | private                                                 |
| `MARKET_DATA_SERVICE_URL`           | yes                | private                                                 |
| `PAYMENTS_SERVICE_URL`              | optional           | unused upstream OK                                      |
| `COMPLIANCE_SERVICE_URL`            | optional           | unused OK                                               |
| `CUSTODY_SERVICE_URL`               | optional           | unused OK                                               |
| `NOTIFICATIONS_SERVICE_URL`         | optional           | unused OK                                               |
| `ANALYTICS_SERVICE_URL`             | optional           | unused OK                                               |
| `OBSERVABILITY_SERVICE_URL`         | optional           | unused OK                                               |
| `AI_SERVICE_URL`                    | optional           | unused OK                                               |
| `SWAP_SERVICE_URL`                  | optional           | unused OK                                               |
| `NFT_SERVICE_URL`                   | optional           | NFT handled as 410 locally                              |
| `STAKING_SERVICE_URL`               | optional           | unused OK                                               |
| `BRIDGE_SERVICE_URL`                | optional           | unused OK                                               |
| `GATEWAY_RATE_LIMIT_MAX`            | recommended        | e.g. `400`                                              |
| `GATEWAY_RATE_LIMIT_WINDOW_SECONDS` | recommended        | e.g. `60`                                               |
| `PROXY_TIMEOUT_MS`                  | recommended        | e.g. `30000`                                            |
| `INTERNAL_API_KEY`                  | yes (prod metrics) | shared secret                                           |
| `DATABASE_URL` / `REDIS_URL`        | optional           | gateway does not require them for Closed Beta           |

### auth (PRIVATE)

| Name                             | Required    | Notes                      |
| -------------------------------- | ----------- | -------------------------- |
| `PORT` / `AUTH_PORT`             | yes         | `4001`                     |
| `DATABASE_URL`                   | yes         | ref shared                 |
| `REDIS_URL`                      | yes         | ref shared                 |
| `JWT_ACCESS_SECRET`              | yes         |                            |
| `JWT_REFRESH_SECRET`             | yes         |                            |
| `CSRF_SECRET`                    | yes         |                            |
| `COOKIE_SECURE`                  | yes         | `true`                     |
| `COOKIE_DOMAIN`                  | yes (empty) | host-only on API           |
| `APP_PUBLIC_URL`                 | yes         | `https://auvorawallet.com` |
| `CORS_ORIGINS`                   | recommended | include www if needed      |
| `AUTH_ALLOW_UNVERIFIED_LOGIN`    | yes         | `false`                    |
| `MAIL_DRIVER`                    | yes         | `smtp`                     |
| `SMTP_HOST`                      | yes         | `smtp.resend.com`          |
| `SMTP_PORT`                      | yes         | `587`                      |
| `SMTP_USER`                      | yes         | secret                     |
| `SMTP_PASS`                      | yes         | secret                     |
| `SMTP_FROM`                      | yes         | `noreply@auvorawallet.com` |
| `SMTP_FROM_NAME`                 | recommended | `Auvora Wallet`            |
| `MAIL_RATE_LIMIT_MAX`            | recommended |                            |
| `MAIL_RATE_LIMIT_WINDOW_SECONDS` | recommended |                            |
| `INTERNAL_API_KEY`               | recommended |                            |
| `LOCKOUT_*` / `RATE_LIMIT_*`     | optional    | defaults OK                |

### wallet (PRIVATE)

| Name                     | Required    | Notes                            |
| ------------------------ | ----------- | -------------------------------- |
| `PORT`                   | yes         | `3002`                           |
| `DATABASE_URL`           | yes         |                                  |
| `REDIS_URL`              | yes         |                                  |
| `JWT_ACCESS_SECRET`      | yes         |                                  |
| `CSRF_SECRET`            | yes         |                                  |
| `BLOCKCHAIN_SERVICE_URL` | yes         | private blockchain               |
| `INTERNAL_API_KEY`       | recommended |                                  |
| `WALLET_WORKERS_ENABLED` | optional    | `true` if background sync wanted |

### blockchain (PRIVATE)

| Name                           | Required    | Notes                                  |
| ------------------------------ | ----------- | -------------------------------------- |
| `PORT`                         | yes         | `3003`                                 |
| `DATABASE_URL`                 | yes         |                                        |
| `REDIS_URL`                    | yes         |                                        |
| `JWT_ACCESS_SECRET`            | yes         |                                        |
| `CSRF_SECRET`                  | yes         |                                        |
| `BLOCKCHAIN_PRIMARY_PROVIDER`  | yes         | `alchemy`                              |
| `BLOCKCHAIN_SIMULATOR_ENABLED` | yes         | `false`                                |
| `ALCHEMY_API_KEY`              | yes (prod)  | **never** on Vercel/web                |
| `ALCHEMY_*_RPC_URL`            | optional    | overrides                              |
| `ALCHEMY_RPC_TIMEOUT_MS`       | optional    |                                        |
| `ALCHEMY_REQUIRED`             | recommended | prod default true when alchemy primary |
| `INTERNAL_API_KEY`             | recommended |                                        |

### connections (PRIVATE)

| Name                      | Required    | Notes                |
| ------------------------- | ----------- | -------------------- |
| `PORT`                    | yes         | `3016`               |
| `DATABASE_URL`            | yes         |                      |
| `REDIS_URL`               | yes         |                      |
| `JWT_ACCESS_SECRET`       | yes         |                      |
| `CSRF_SECRET`             | yes         |                      |
| `CONNECTIONS_*` / workers | optional    | pin simulators false |
| `INTERNAL_API_KEY`        | recommended |                      |

### market-data (PRIVATE)

| Name                            | Required    | Notes   |
| ------------------------------- | ----------- | ------- |
| `PORT`                          | yes         | `3012`  |
| `DATABASE_URL`                  | yes         |         |
| `REDIS_URL`                     | yes         |         |
| `JWT_ACCESS_SECRET`             | yes         |         |
| `CSRF_SECRET`                   | yes         |         |
| `MARKET_DATA_SIMULATOR_ENABLED` | yes         | `false` |
| `COINGECKO_*`                   | optional    |         |
| `INTERNAL_API_KEY`              | recommended |         |

---

## Vercel web (not Railway) — names only

| Name                             | Prod non-secret value             |
| -------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `https://api.auvorawallet.com`    |
| `NEXT_PUBLIC_APP_URL`            | `https://auvorawallet.com`        |
| `NEXT_PUBLIC_APP_NAME`           | `Auvora Wallet`                   |
| `NEXT_PUBLIC_STATUS_URL`         | `https://auvorawallet.com/status` |
| `NEXT_PUBLIC_MARKETING_URL`      | `https://auvorawallet.com`        |
| `NEXT_PUBLIC_WC_PROJECT_ID`      | Reown Project ID only             |
| `NEXT_PUBLIC_ADMIN_URL`          | optional                          |
| `NEXT_PUBLIC_DOCS_URL`           | optional                          |
| `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | optional                          |

### Never on Vercel

`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `CSRF_SECRET`, `INTERNAL_API_KEY`, `ALCHEMY_*`, `SMTP_*`, Reown **Secret**, field encryption keys, object-storage keys.

---

## Email address roles (ops)

| Role               | Address                    | Where configured          |
| ------------------ | -------------------------- | ------------------------- |
| Transactional From | `noreply@auvorawallet.com` | `SMTP_FROM` on auth       |
| Support (public)   | `support@auvorawallet.com` | UI / docs — not SMTP From |
| Admin              | do not expose in public UI |                           |

---

## Reown

| Name                        | Where                   | Public?         |
| --------------------------- | ----------------------- | --------------- |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Vercel web              | Yes             |
| `WC_PROJECT_ID`             | Mobile dart-define      | Project ID only |
| Reown Secret                | Never mobile/web public | No              |

**DEVICE VERIFICATION REQUIRED** before Closed Beta tester invites (physical web→Android pair).

---

## Inventory status

**ENVIRONMENT MATRIX: COMPLETE** (names catalogued; live Railway values not provisioned in this pass).
