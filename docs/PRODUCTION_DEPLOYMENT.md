# Production Deployment — Auvora Wallet

**Task:** 036 — Launch Phase  
**Version:** `1.0.0-rc.1` → production track  
**Constraint:** Extend existing Helm / Terraform / Actions; no architecture replacement

---

## Mission

Deliver a **deployable production platform**: frontend, backend APIs, WebSocket-capable gateway edge, background workers, cron/backup jobs, Redis, PostgreSQL, object storage, CDN, and environment separation.

## Architecture (deployable units)

| Unit               | How it ships                                            | Runtime                                 |
| ------------------ | ------------------------------------------------------- | --------------------------------------- |
| Frontend (web)     | `Dockerfile.next` → GHCR `web`                          | Next.js standalone                      |
| Admin              | `Dockerfile.next` → GHCR `admin`                        | Next.js standalone                      |
| Docs               | `Dockerfile.next` → GHCR `docs`                         | Next.js standalone                      |
| API edge           | `Dockerfile.service` → `gateway-service`                | NestJS `:4000`                          |
| Domain services    | Same Dockerfile matrix (17 services)                    | NestJS                                  |
| Background workers | In-process Nest workers (env-gated)                     | Same pods / optional dedicated replicas |
| Cron / backups     | Helm `backup-cronjob.yaml`                              | `pg_dump` + optional upload URI         |
| PostgreSQL         | Managed cloud (prod) or chart opt-in                    | Prisma + pool params                    |
| Redis              | Managed cloud (prod) or chart opt-in                    | Sessions / queues / rate limits         |
| Object storage     | Terraform `modules/storage` + env                       | Assets, backup targets                  |
| CDN                | `CDN_ASSET_BASE_URL` / `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | Static + NFT media                      |

WebSocket: clients connect to `api.example.com` (gateway) over WSS; TLS terminates at ingress.

## Environments

| Env               | Namespace                      | Values file                     |
| ----------------- | ------------------------------ | ------------------------------- |
| local             | `auvora-local`                 | `values-local.yaml`             |
| development       | `auvora-development`           | `values-development.yaml`       |
| qa / testing      | `auvora-qa` / `auvora-testing` | matching values                 |
| staging           | `auvora-staging`               | `values-staging.yaml`           |
| production        | `auvora-production`            | `values-production.yaml`        |
| disaster-recovery | `auvora-disaster-recovery`     | `values-disaster-recovery.yaml` |

## Deploy path

1. **CI** (`.github/workflows/ci.yml`) — lint, typecheck, test, build
2. **Build Images** — push signed images to GHCR
3. **Promote Release** — staging soak gate
4. **Deploy** — Helm upgrade with production confirmation + optional `prisma migrate deploy`
5. **Smoke** — `infrastructure/scripts/smoke-health.sh`
6. **Rollback** — automatic `helm rollback` on failure

```bash
# Manual dry-run (no kube secret)
# GitHub → Actions → Deploy → environment=staging, image_tag=<sha>

# Production (requires confirm_production=deploy-production)
```

## Database migrations (production)

```bash
# From CI (Deploy workflow, run_migrations=true) or operator laptop with VPN:
export DATABASE_URL='postgresql://…'   # from secrets manager
pnpm --filter @auvora/database-schema exec prisma migrate deploy
```

Never run `migrate:dev` against production. Rollback strategy: restore from PITR / snapshot then re-apply known-good migration set (see [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).

## SSL / cookies

- Ingress: `ssl-redirect`, force HTTPS, cert-manager Let’s Encrypt
- HSTS via ingress `configuration-snippet`
- `COOKIE_SECURE=true`, `COOKIE_DOMAIN=.example.com` in production values

## Related docs

- [`DOMAIN_CONFIGURATION.md`](./DOMAIN_CONFIGURATION.md)
- [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md)
- [`CI_CD_GUIDE.md`](./CI_CD_GUIDE.md)
- [`PUBLIC_LAUNCH_CHECKLIST.md`](./PUBLIC_LAUNCH_CHECKLIST.md)
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
