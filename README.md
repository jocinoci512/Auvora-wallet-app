# Auvora Wallet

Enterprise cryptocurrency wallet platform monorepo. This repository contains shared packages, NestJS microservices, Next.js apps, database schema, and cloud-agnostic infrastructure.

**Current product version:** `1.0.0-rc.1` — Phases 1–14 (Release Candidate). GA cut remains gated by staging soak and remaining checklist items.

| Doc | Purpose |
|-----|---------|
| [`BUILD_STATUS.md`](BUILD_STATUS.md) | Latest lint/test/build/perf verification |
| [`docs/RELEASE_CANDIDATE_v1.0.md`](docs/RELEASE_CANDIDATE_v1.0.md) | Phase 14 RC dossier (19 sections) |
| [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md) | RC release notes |
| [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) | Documentation map |
| [`CODE_QUALITY_REPORT.md`](CODE_QUALITY_REPORT.md) | Maintainability audit findings |
| [`TECHNICAL_DEBT_REPORT.md`](TECHNICAL_DEBT_REPORT.md) | Tracked debt and deferred upgrades |
| [`FINAL_RELEASE_CHECKLIST.md`](FINAL_RELEASE_CHECKLIST.md) | Pre-GA gate checklist |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | GitHub → Vercel + backend auto-deploy setup |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architecture overview |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | ADR index (0001–0010) |

## Architecture

- **packages/** — Shared libraries (`types`, `ui`, `sdk`, `database`, `security`, `config`, `resilience`, `cache`, `secrets`)
- **services/** — NestJS 11 services with hexagonal layout (domain, application, infrastructure, presentation)
- **apps/** — Next.js 15 App Router frontends (web, admin, docs)
- **database/** — Prisma schema, migrations, and seed scripts
- **infrastructure/** — Docker, Kubernetes/Helm, Terraform, and observability configs

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/diagrams/](docs/diagrams/) for details.

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- pnpm >= 9.15 (repo ships `.tools/pnpm` if needed)
- Docker (optional, for Postgres and Redis)

## Setup

```bash
pnpm install
node scripts/bootstrap.mjs
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Copy `.env.example` values into `.env` via `scripts/bootstrap.mjs` if you have not already.

## Quality / performance harness

```bash
pnpm lint && pnpm test && pnpm build
pnpm perf:benchmark   # before/after optimization metrics
pnpm perf:load        # load suite
pnpm perf:chaos       # readiness / failure surfaces
pnpm perf:resilience  # library failure simulation
pnpm perf:a11y        # accessibility smoke (lang/viewport/landmarks)
pnpm perf:journeys    # critical API journey contracts
```

## Phase overview

| Phase | Scope | Status |
|-------|--------|--------|
| 1–2 | Foundation, gateway, auth | Complete |
| 3–5 | Wallet, blockchain, payments | Complete |
| 6–8 | Compliance, custody, notifications | Complete |
| 9–11 | AI, analytics, observability | Complete |
| 12 | Production infrastructure | Complete |
| 13 | Performance / security / resilience | Complete |
| ERV | Enterprise readiness verification | Complete |
| Audit | Code quality / technical debt | Complete |
| **14** | Final production readiness & **RC v1.0.0-rc.1** | **Complete (RC)** |
| GA | Production GA | Not started |

Historical phase runbooks remain below for local bring-up of early services.

## Phase 2 — Authentication

Phase 2 introduces a dedicated **auth service** and a **gateway** that reverse-proxies public auth routes. Clients (web, admin) talk only to the gateway; the gateway forwards `/api/v1/auth/*`, `/api/v1/me/*`, and `/api/v1/admin/*` to auth.

### Architecture

```text
Browser (web :3000, admin :3001)
        │
        ▼
  Gateway :4000  ──proxy──▶  Auth :4001
        │                         │
        └─────────┬───────────────┘
                  ▼
           Postgres + Redis
```

- **Gateway** — API entry point, security headers, Swagger at `/api/docs`, health at `/health` and `/ready`.
- **Auth** — Sessions, JWT, CSRF, admin APIs (implementation lives in `services/auth`).
- **Seed admin** — Created on `pnpm db:seed` using `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME`, and `SEED_ADMIN_PASSWORD` from `.env`.

### Ports (Phase 2)

| Component | Port |
|-----------|------|
| gateway | 4000 |
| auth | 4001 |
| web | 3000 |
| admin | 3001 |
| docs | 3011 |

Swagger (gateway proxy contract): [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

### Run locally

```bash
# Infrastructure (Docker)
docker compose up -d

# Or without Docker Desktop:
#   node scripts/migrate-with-embedded-pg.mjs   # Terminal A (Postgres + migrate + seed)
#   node scripts/start-redis.mjs                # Terminal B

# Database (when using Docker Compose)
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Backend (separate terminals)
PORT=4001 pnpm --filter @auvora/auth-service dev
PORT=4000 pnpm --filter @auvora/gateway-service dev

# Frontends
pnpm --filter @auvora/web dev
pnpm --filter @auvora/admin dev
```

Ensure `.env` includes secrets from `.env.example` (JWT, cookie, CSRF, mail, seed admin). Default seed admin credentials come from `SEED_ADMIN_*` variables — use only in development.

## Phase 3 — Wallet Core

Phase 3 adds the **wallet service** and gateway proxy routes for wallet APIs. User and admin UIs call the gateway with a JWT Bearer token.

### Architecture

```text
Browser (web :3000, admin :3001)
        │
        ▼
  Gateway :4000  ──proxy──▶  Auth :4001
        │                         │
        ├──────proxy────────▶  Wallet :3002
        │                         │
        └─────────┬───────────────┘
                  ▼
           Postgres + Redis
```

- **Gateway** — Proxies `/api/v1/wallets/*` and `/api/v1/admin/wallets/*` to the wallet service (after auth routes).
- **Wallet** — Wallet lifecycle, balances, ledger, and transactions (`services/wallet`).
- **Web** — User wallet list, create, detail pages at `/wallets`.
- **Admin** — Searchable wallet management at `/wallets`.

### Ports (Phase 3)

| Component | Port |
|-----------|------|
| gateway | 4000 |
| auth | 4001 |
| wallet | 3002 |
| web | 3000 |
| admin | 3001 |

Gateway Swagger (includes wallet proxy paths): [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

### Run locally

```bash
# Backend (separate terminals, after Phase 2 setup)
PORT=4001 pnpm --filter @auvora/auth-service dev
PORT=3002 pnpm --filter @auvora/wallet-service dev
PORT=4000 pnpm --filter @auvora/gateway-service dev

# Frontends
pnpm --filter @auvora/web dev
pnpm --filter @auvora/admin dev
```

Set `WALLET_SERVICE_URL=http://127.0.0.1:3002` in `.env` for the gateway.

### Wallet API (via gateway)

| Area | Endpoints |
|------|-----------|
| User | `GET/POST /api/v1/wallets`, `GET/PATCH /api/v1/wallets/:id`, balance, transactions, activate/suspend/archive/restore |
| Admin | `GET /api/v1/admin/wallets`, `GET /api/v1/admin/wallets/:id`, suspend/restore/archive |

### UI authentication

Web and admin pages read `localStorage` key **`auvora_access_token`**. Paste a JWT from `POST /api/v1/auth/login` on the gateway (use the seed admin account for admin UI). Set `NEXT_PUBLIC_API_URL=http://localhost:4000` so the browser calls the gateway.

## Phase 4 — Blockchain

Phase 4 adds the **blockchain service** and gateway proxy routes for chain address, transaction, and network-status APIs. It is the system of record for on-chain addresses, transactions, blocks, and provider health — the wallet service's `BlockchainProviderPort` stubs remain local, address-format-only helpers and defer chain state to this service.

### Architecture

```text
Browser (web :3000, admin :3001)
        │
        ▼
  Gateway :4000  ──proxy──▶  Auth :4001
        │                         │
        ├──────proxy────────▶  Wallet :3002
        │                         │
        ├──────proxy────────▶  Blockchain :3003 (simulator/local providers)
        │                         │
        └─────────┬───────────────┘
                  ▼
           Postgres + Redis
```

- **Gateway** — Proxies `/api/v1/blockchain/*` and `/api/v1/admin/blockchain/*` to the blockchain service (registered after the wallet proxy).
- **Blockchain** — Chain address lifecycle, balances, transactions, fee estimation, provider health, sync jobs, blocks, and event log (`services/blockchain`).
- **Web** — Supported chains and network status at `/blockchain`, address list/create at `/blockchain/addresses`, address detail at `/blockchain/addresses/:id`, and user transaction history at `/blockchain/transactions`.
- **Admin** — Operational dashboard at `/blockchain` plus dedicated views for providers, sync jobs, blocks, transactions, addresses, and the event log.

### Ports (Phase 4)

| Component | Port |
|-----------|------|
| gateway | 4000 |
| auth | 4001 |
| wallet | 3002 |
| blockchain | 3003 |
| web | 3000 |
| admin | 3001 |

Gateway Swagger (includes blockchain proxy paths): [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

### Run locally

```bash
# Backend (separate terminals, after Phase 2/3 setup)
PORT=4001 pnpm --filter @auvora/auth-service dev
PORT=3002 pnpm --filter @auvora/wallet-service dev
PORT=3003 pnpm --filter @auvora/blockchain-service dev
PORT=4000 pnpm --filter @auvora/gateway-service dev

# Frontends
pnpm --filter @auvora/web dev
pnpm --filter @auvora/admin dev
```

Set `BLOCKCHAIN_SERVICE_URL=http://127.0.0.1:3003` in `.env` for the gateway (and, optionally, for the wallet service if it needs to call blockchain address validation directly).

### Blockchain API (via gateway)

| Area | Endpoints |
|------|-----------|
| Chains & network | `GET /api/v1/blockchain/chains`, `GET /api/v1/blockchain/network-status` |
| Addresses | `GET/POST /api/v1/blockchain/addresses`, `GET/PATCH /api/v1/blockchain/addresses/:id`, activate/archive/set-primary, `POST /api/v1/blockchain/addresses/validate`, `GET /api/v1/blockchain/addresses/:id/balance` |
| Transactions & fees | `GET /api/v1/blockchain/transactions`, `GET /api/v1/blockchain/transactions/:id`, `POST /api/v1/blockchain/fees/estimate` |
| Admin | `GET /api/v1/admin/blockchain/providers`, `GET /api/v1/admin/blockchain/health`, `GET /api/v1/admin/blockchain/sync-jobs`, `POST /api/v1/admin/blockchain/sync-jobs/trigger`, `GET /api/v1/admin/blockchain/blocks`, `GET /api/v1/admin/blockchain/transactions`, `GET /api/v1/admin/blockchain/addresses`, `GET /api/v1/admin/blockchain/metrics`, `GET /api/v1/admin/blockchain/events` |

### Providers & confirmation thresholds

The blockchain service is designed to run against a **local simulator/mock provider** in development (no real node or third-party RPC required) — see `blockchain_providers` for per-chain provider configuration and priority/failover ordering. Required confirmation counts before a transaction is considered final are **per-chain, DB-driven** values stored on `blockchain_network_configs.required_confirmations` (surfaced to clients via `GET /api/v1/blockchain/chains` and per-transaction as `requiredConfirmations`), not hardcoded in application code.

## Phase 6 — Compliance

Phase 6 adds the **compliance service** (KYC, AML, risk, sanctions/PEP, cases, rules, providers) as the policy enforcement engine.

```text
Browser (web :3000, admin :3001)
        │
        ▼
  Gateway :4000  ──proxy──▶  Auth / Wallet / Blockchain / Payments
        │
        ├──────proxy────────▶  Compliance :3005
        │
Payments :3004 ──internal HTTP──▶ Compliance /fraud/check (optional)
```

- **Env:** `COMPLIANCE_SERVICE_URL`, `COMPLIANCE_SIMULATOR_ENABLED` (default false), `COMPLIANCE_FIELD_ENCRYPTION_KEY`
- **Web:** `/compliance`, `/compliance/documents`
- **Admin:** `/compliance`, `/compliance/alerts`, `/compliance/cases`, `/compliance/rules`
- **Integrity:** see `BUILD_STATUS.md`, `CHANGELOG.md`, `ARCHITECTURE_DECISIONS.md`, and [docs/INTEGRATION_REPORT_PHASE6.md](docs/INTEGRATION_REPORT_PHASE6.md)

## Phase 7 — Custody

Phase 7 adds the **custody service** (keys, signing, approvals, recovery, multi-model providers) on port **3009**.

```text
Gateway :4000 ──proxy──▶ Custody :3009
Blockchain :3003 ──optional internal sign──▶ Custody
```

- **Env:** `CUSTODY_SERVICE_URL`, `CUSTODY_SIMULATOR_ENABLED`, `CUSTODY_FIELD_ENCRYPTION_KEY`
- **Web:** `/custody`, `/custody/signing`, `/custody/recovery`, `/custody/activity`
- **Admin:** `/custody` (+ keys, signing, approvals, policies, signers, audit)
- **Integrity:** [docs/INTEGRATION_REPORT_PHASE7.md](docs/INTEGRATION_REPORT_PHASE7.md)

## Phase 8 — Notifications

Phase 8 adds the **notifications service** (email/SMS/push/in-app/webhooks, templates, preferences, queue) on port **3006**.

- **Env:** `NOTIFICATIONS_SERVICE_URL`, `NOTIFICATIONS_SIMULATOR_ENABLED`, `NOTIFICATIONS_FIELD_ENCRYPTION_KEY`
- **Web:** `/notifications`, `/notifications/preferences`, `/notifications/webhooks`
- **Admin:** `/notifications` (+ templates, queue, failed, broadcast, webhooks)
- **Integrity:** [docs/INTEGRATION_REPORT_PHASE8.md](docs/INTEGRATION_REPORT_PHASE8.md)

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in parallel via Turbo |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm typecheck` | TypeScript project references check |
| `pnpm test` | Jest unit and integration tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed schema metadata |
| `pnpm docs:api` | Generate TypeDoc API reference |

## Service ports

| Service | Port |
|---------|------|
| gateway | 4000 |
| auth | 4001 |
| wallet | 3002 |
| blockchain | 3003 |
| payments | 3004 |
| compliance | 3005 |
| custody | 3009 |
| notifications | 3006 |
| analytics | 3007 |
| ai | 3008 |

## App ports

| App | Port |
|-----|------|
| web | 3000 |
| admin | 3001 |
| docs | 3011 |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md), and [BUILD_STATUS.md](BUILD_STATUS.md).

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).