# Environment Setup — Auvora Wallet

**Task:** 036  
**Templates only — never commit real secrets.**

---

## Template files

| File | Audience |
|------|----------|
| [`.env.example`](../.env.example) | Complete template (local + annotated prod overrides) |
| [`.env.staging.example`](../.env.staging.example) | Staging operators |
| [`.env.production.example`](../.env.production.example) | Production operators |
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | GitHub → Vercel → Helm auto-deploy setup |

Copy to untracked `.env` / secret store entries. Generate secrets with:

```bash
openssl rand -hex 32
openssl rand -base64 48
```

## Separation matrix

| Concern | Development | Staging | Production |
|---------|-------------|---------|------------|
| `NODE_ENV` | `development` | `production` | `production` |
| `COOKIE_SECURE` | `false` | `true` | `true` |
| Simulators | allowed | off when live providers exist | **must be false** |
| Secrets source | local `.env` | External Secrets | External Secrets |
| DB | docker / embedded | managed | managed + pooling |
| `LOG_LEVEL` | `info`/`debug` | `info` | `warn` |
| OTEL | optional | on | on |

## Audit categories

1. **Runtime** — `NODE_ENV`, `LOG_LEVEL`, `PORT`, `SERVICE_NAME`  
2. **Data** — `DATABASE_URL`, `REDIS_URL`  
3. **Identity** — `JWT_*`, `CSRF_SECRET`, `COOKIE_*`, `APP_PUBLIC_URL`  
4. **Edge** — `CORS_ORIGINS`, `INTERNAL_API_KEY`, rate limits  
5. **Domains** — all `NEXT_PUBLIC_*` / `CDN_*` / `OBJECT_STORAGE_*`  
6. **Providers** — Alchemy, mail, DEX, NFT, etc. (per-service schemas)  
7. **Workers** — `*_WORKERS_ENABLED`, queue poll intervals  
8. **Observability** — `OTEL_*`  

Each Nest service validates with Zod (`services/*/src/config/env.schema.ts`). Next apps use `apps/*/src/env.ts`.

## Kubernetes injection

- Non-secret config → Helm ConfigMap (`templates/configmap.yaml`) from `values.config`  
- Secrets → ExternalSecret keys listed in `values.yaml` → `secretRef` on pods  
- Never bake secrets into images  

## Connection pooling

Prefer PgBouncer or Prisma URL params in production:

```text
?schema=public&connection_limit=40&pool_timeout=10
```

## Checklist before first staging deploy

- [ ] Staging DNS + TLS ready  
- [ ] External Secrets remote key populated  
- [ ] `COOKIE_SECURE=true`  
- [ ] CORS allow-list matches staging hosts  
- [ ] Simulators disabled where live providers exist  
- [ ] `INTERNAL_API_KEY` set  
