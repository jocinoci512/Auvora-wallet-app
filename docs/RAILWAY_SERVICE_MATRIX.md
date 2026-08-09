# Auvora — Railway Service Matrix (Closed Beta)

**Date:** 2026-08-03  
**Companion:** [`RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md`](./RAILWAY_CLOSED_BETA_DEPLOYMENT_PLAN.md)

---

## Summary

| Metric                        | Value                  |
| ----------------------------- | ---------------------- |
| Total Nest backend services   | **17**                 |
| Required to run (Closed Beta) | **6**                  |
| Not required to run           | **11**                 |
| Public Railway service        | **gateway only**       |
| NFT                           | ABSENT — do not deploy |
| Broadcast                     | OFF                    |

---

## Required at launch

| Service     | Port | Dockerfile args                   | Networking | Critical deps                   | Health                                   | Notes                                   |
| ----------- | ---- | --------------------------------- | ---------- | ------------------------------- | ---------------------------------------- | --------------------------------------- |
| gateway     | 4000 | `SERVICE=gateway` `PORT=4000`     | **Public** | `*_SERVICE_URL`, CORS           | `/health`, `/ready` (auth)               | In-memory RL → 1 replica; NFT 410 local |
| auth        | 4001 | `SERVICE=auth` `PORT=4001`        | Private    | Postgres, Redis, SMTP, JWT/CSRF | `/health`, `/ready`                      | Mail via Resend SMTP                    |
| wallet      | 3002 | `SERVICE=wallet` `PORT=3002`      | Private    | Postgres, Redis, blockchain URL | `/health`, `/ready`                      | Workers optional for beta               |
| blockchain  | 3003 | `SERVICE=blockchain` `PORT=3003`  | Private    | Postgres, Redis, Alchemy        | `/health`, `/ready`, `/health/providers` | Server-side Alchemy only                |
| connections | 3016 | `SERVICE=connections` `PORT=3016` | Private    | Postgres, Redis                 | `/health`, `/ready`                      | Companion WC/device paths               |
| market-data | 3012 | `SERVICE=market-data` `PORT=3012` | Private    | Postgres, Redis                 | `/health`, `/ready`                      | CoinGecko optional                      |

---

## Not required to run (code retained)

| Service       | Port | Why deferred                                               |
| ------------- | ---- | ---------------------------------------------------------- |
| payments      | 3004 | Not Closed Beta companion path                             |
| compliance    | 3005 | Not Closed Beta companion path                             |
| notifications | 3006 | Auth SMTP covers transactional mail                        |
| analytics     | 3007 | Optional                                                   |
| ai            | 3008 | Optional; simulators forbidden in prod                     |
| custody       | 3009 | Not Closed Beta                                            |
| observability | 3010 | Optional (use platform logs)                               |
| swap          | 3013 | Preview / not required                                     |
| **nft**       | 3014 | **Product ABSENT**; gateway 410; Helm `nft.enabled: false` |
| staking       | 3015 | Not required                                               |
| bridge        | 3017 | Not required                                               |

Gateway may still define `*_SERVICE_URL` for these; missing processes yield controlled 502/503.

---

## Managed dependencies (Railway)

| Resource    | Version             | Consumers (Closed Beta)                            | Networking |
| ----------- | ------------------- | -------------------------------------------------- | ---------- |
| Postgres    | **16** + **citext** | auth, wallet, blockchain, connections, market-data | Private    |
| Redis       | **7**               | Same set                                           | Private    |
| Resend SMTP | external            | auth                                               | Egress     |
| Alchemy     | external            | blockchain                                         | Egress     |

---

## Gateway proxy map (Closed Beta traffic)

| Prefix                                                                     | Upstream          | Expected     |
| -------------------------------------------------------------------------- | ----------------- | ------------ |
| `/api/v1/auth`, `/api/v1/me`, `/api/v1/admin/users`, `/api/v1/admin/audit` | auth              | Live         |
| `/api/v1/wallets`, `/api/v1/wallet-engine`, admin wallets                  | wallet            | Live         |
| `/api/v1/blockchain`                                                       | blockchain        | Live         |
| `/api/v1/connections`                                                      | connections       | Live         |
| `/api/v1/market-data`                                                      | market-data       | Live         |
| `/api/v1/nfts`                                                             | _(local)_         | **410 Gone** |
| Other `/api/v1/*`                                                          | deferred services | 502/503 OK   |

---

## Temporary db-migrate (production schema only)

One-shot Prisma runner — **not** part of Closed Beta runtime. Create in Railway UI, run once, tear down.

| Setting              | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| Service name         | `db-migrate` (temporary)                                   |
| Root Directory       | blank / `/`                                                |
| Dockerfile path      | `infrastructure/docker/Dockerfile.migrate`                 |
| Custom start command | **empty**                                                  |
| Networking           | Private (no public URL, no `PORT`)                         |
| Variables            | **`DATABASE_URL` only** (same Postgres as Nest services)   |
| CMD                  | `migrate deploy` then `migrate status` (both must succeed) |

Do **not** use `Dockerfile.service` for this. Do **not** attach Redis/JWT/SMTP/Alchemy. See [`infrastructure/docker/README.md`](../infrastructure/docker/README.md).

---

## Image build reference

```text
infrastructure/docker/Dockerfile.service
  --build-arg SERVICE=<name>   # required (no default)
  --build-arg PORT=<port>
```

| SERVICE     | PORT | Turbo filter                  |
| ----------- | ---- | ----------------------------- |
| gateway     | 4000 | `@auvora/gateway-service`     |
| auth        | 4001 | `@auvora/auth-service`        |
| wallet      | 3002 | `@auvora/wallet-service`      |
| blockchain  | 3003 | `@auvora/blockchain-service`  |
| connections | 3016 | `@auvora/connections-service` |
| market-data | 3012 | `@auvora/market-data-service` |

Node 22 · pnpm 9.15 (Corepack) · `pnpm deploy --prod` runtime bundle · non-root `auvora` · HEALTHCHECK `/health` · no secrets in image.

Repo pins this via root `railway.toml` (`builder = DOCKERFILE`, `dockerfilePath = infrastructure/docker/Dockerfile.service`) and a root `Dockerfile` mirror for auto-detection. **`railway.toml` cannot set buildArgs** — each Railway service must define Variables `SERVICE` + `PORT`. Details: [`infrastructure/docker/README.md`](../infrastructure/docker/README.md).

Validate context stubs: `node infrastructure/docker/validate-service-context.mjs`
---

## Railway UI settings (auth-v2 / Nest services)

Use these for **auth** (and the same pattern for other Nest services). Config-as-code overrides the dashboard when both are set.

| Setting              | Value                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Source repo          | `jocinoci512/Auvora-wallet-app`                                                          |
| Branch               | `main`                                                                                   |
| Root Directory       | **blank** or `/` (never `services/auth` or `infrastructure/docker`)                      |
| Builder              | **Dockerfile**                                                                           |
| Dockerfile path      | `infrastructure/docker/Dockerfile.service` (no leading slash; or rely on `railway.toml`) |
| Watch paths          | leave default (entire repo) unless you know you need filters                             |
| Networking           | **Private** (Public networking OFF) for auth                                             |
| Healthcheck path     | `/health`                                                                                |
| Custom start command | **empty** (image `CMD` is `node dist/main.js`)                                           |

**Variables** (required for Docker `ARG` + runtime; Railway injects matching `ARG`s at build — config-as-code has **no** `buildArgs` field):

| Name                      | Auth value                                                  |
| ------------------------- | ----------------------------------------------------------- |
| `SERVICE`                 | `auth` (required; build fails if missing/wrong)             |
| `PORT`                    | `4001`                                                      |
| `RAILWAY_DOCKERFILE_PATH` | optional backup: `infrastructure/docker/Dockerfile.service` |

Also set runtime secrets (`DATABASE_URL`, `REDIS_URL`, JWT/CSRF, SMTP, etc.) per [`RAILWAY_ENVIRONMENT_MATRIX.md`](./RAILWAY_ENVIRONMENT_MATRIX.md).

**Do not** use Railpack/Nixpacks for Nest services when the Docker path is configured — a missing/empty Dockerfile path is the usual cause of toast **"There was an error deploying from source"** with no build logs.

**Do not** rely on Dockerfile `SERVICE` defaults — the image deliberately has **no** default so a misconfigured auth/wallet/etc. service cannot silently build gateway.
