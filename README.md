# Auvora Wallet

Enterprise cryptocurrency wallet platform monorepo. This repository contains the engineering foundation: shared packages, NestJS microservices, Next.js apps, database schema, and infrastructure stubs.

## Architecture

- **packages/** — Shared libraries (`@auvora/types`, `@auvora/ui`, `@auvora/sdk`, `@auvora/database`, `@auvora/security`, `@auvora/config`)
- **services/** — NestJS 11 services with hexagonal layout (domain, application, infrastructure, presentation)
- **apps/** — Next.js 15 App Router frontends (web, admin, docs)
- **database/** — Prisma schema, migrations, and seed scripts
- **infrastructure/** — Docker, Kubernetes, Terraform, and observability configs

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- pnpm >= 9.15
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
| docs | 3002 |

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
| notifications | 3006 |
| analytics | 3007 |
| ai | 3008 |

## App ports

| App | Port |
|-----|------|
| web | 3000 |
| admin | 3001 |
| docs | 3002 |

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).