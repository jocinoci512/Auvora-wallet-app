# Deployment Readiness — Pre-Deployment Audit

**Date:** 2026-07-27  
**Operator guide:** [`DEPLOYMENT.md`](./DEPLOYMENT.md)

---

## Scorecard

| Dimension | Status |
|-----------|--------|
| Artifact build (apps + services) | **READY** |
| CI on `main`/`master` | **READY** |
| Continuous Deployment workflow | **READY** (secrets optional skip) |
| Vercel frontend wiring | **READY** (config present; connect project) |
| Backend images (GHCR) | **READY** |
| Helm staging auto-deploy | **READY when `KUBE_CONFIG_DATA` set** |
| Production Helm | **GATED** (`confirm_production`) |
| Public GA | **HOLD** |

**Deployment readiness: READY for staging/closed-beta automation after one-time secret setup; NOT ready for unrestricted public GA.**

---

## What auto-deploys on push to `main`/`master`

1. Quality gates (lint / test / build)  
2. Vercel frontends (if GitHub integration or `VERCEL_*` secrets)  
3. GHCR images for services + Next apps  
4. Helm **staging** (if `KUBE_CONFIG_DATA`)  

Production cluster updates remain manual + confirmed.

---

## Safe CD hardening this audit

- Disabled `cancel-in-progress` on CD to avoid cutting off live Helm upgrades  

---

## Blockers for “production-ready” public launch

1. Complete [`docs/PUBLIC_LAUNCH_CHECKLIST.md`](./docs/PUBLIC_LAUNCH_CHECKLIST.md)  
2. Wire staging/prod secrets, DNS, TLS  
3. Enforce CSP after observe window  
4. Pen-test + Redis rate-limit plan  
5. Do not merge large uncommitted WIP without re-running full gates  

---

## Recommendation

| Audience | Call |
|----------|------|
| Staging soak / closed beta | **GO** after `DEPLOYMENT.md` secrets |
| Public GA | **NO-GO** until residuals cleared |
