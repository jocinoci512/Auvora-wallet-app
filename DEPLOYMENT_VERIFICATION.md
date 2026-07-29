# Deployment Verification — Auvora Wallet

**Date:** 2026-07-27  
**Scope:** Confirm deployable production configuration after Task 036  
**Engineering gates:** **PASS**

---

## Deployment status

| Component | Status |
|-----------|--------|
| Container images pipeline | Ready — 17 Nest services + web/admin/docs (`build-images.yml`) |
| Helm chart | Ready — multi-host ingress, HSTS snippet, External Secrets |
| Staging values | Ready — `values-staging.yaml` (`*.staging.example.com`) |
| Production values | Ready — `values-production.yaml` (public hosts) |
| CI validation | Ready — `ci.yml` + `infra-validate.yml` |
| Promote gate | Ready — `promote-release.yml` |
| Deploy + rollback | Ready — `deploy.yml` (prod confirmation + optional migrate) |
| Live cluster cutover | **Pending ops** — requires `KUBE_CONFIG_DATA` + secrets |

This verification confirms **artifacts and workflows** are release-capable. It does not assert that production DNS already resolves.

---

## Public URL map (configured via env / Helm)

| URL | Backend |
|-----|---------|
| https://example.com | web |
| https://www.example.com | web |
| https://app.example.com | web |
| https://api.example.com | gateway |
| https://admin.example.com | admin |
| https://docs.example.com | docs |
| https://status.example.com | web (`/` + `/status`) |

No production hostnames are hardcoded in application source; they flow from `NEXT_PUBLIC_*` / Helm `config` / `ingress.hosts`.

---

## Local runtime evidence (this host)

| Surface | Result |
|---------|--------|
| `http://127.0.0.1:3000/` | 200 READY |
| `http://127.0.0.1:3001/` | 200 READY |
| `http://127.0.0.1:4000/health` | 200 |
| A11y smoke | 5/5 PASS |

---

## Deploy procedure (summary)

1. Build + sign images (`build-images.yml` / `sign-images.yml`)  
2. Deploy **staging** (`deploy.yml` → `staging`)  
3. Soak + acknowledge (`promote-release.yml` with `staging-verified`)  
4. Deploy **production** with `confirm_production=deploy-production`  
5. Optional `run_migrations=true` → `prisma migrate deploy`  
6. Smoke health; auto `helm rollback` on failure  

Details: [`docs/CI_CD_GUIDE.md`](./docs/CI_CD_GUIDE.md), [`docs/PRODUCTION_DEPLOYMENT.md`](./docs/PRODUCTION_DEPLOYMENT.md).

---

## SSL / cookies / secrets

| Control | Verification |
|---------|--------------|
| HTTPS redirect | Ingress `ssl-redirect` + `force-ssl-redirect` |
| HSTS | Ingress configuration-snippet |
| Cert renewal | cert-manager annotation documented |
| `COOKIE_SECURE` | Production values / `.env.production.example` = true |
| Secrets | ExternalSecret key inventory expanded; templates only in Git |

---

## Database / backups

| Item | Status |
|------|--------|
| `prisma migrate deploy` in Deploy workflow | Wired (opt-in) |
| Backup CronJob | Enabled in staging/production Helm values |
| Recovery docs | [`docs/BACKUP_RECOVERY.md`](./docs/BACKUP_RECOVERY.md) |

---

## Residual deployment risks

- Terraform modules still stubbed for live cloud provisioning  
- Backup upload to object storage is operator-wired (`BACKUP_UPLOAD_URI`)  
- Full mesh smoke (auth/wallet mutations) needs staging Postgres/Redis  

---

## Sign-off

| Check | Result |
|-------|--------|
| Code artifacts build | **PASS** |
| Deploy workflows present | **PASS** |
| Domain/env separation | **PASS** |
| Ready for staged production deploy | **YES** (after checklist soak) |
| Live GA traffic approved | **HOLD** until [`docs/PUBLIC_LAUNCH_CHECKLIST.md`](./docs/PUBLIC_LAUNCH_CHECKLIST.md) |
