# Error Fix Report

**Date:** 2026-07-26  
**Scope:** Issues encountered during full-repository verification (post Phase 17)  
**Constraint:** Safe fixes only — no business-logic changes, no breaking API changes

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Blocking gate failures after recovery | 0 | Resolved |
| Code / business-logic patches this pass | 0 | Not required (gates green) |
| Environment / tooling recovery actions | 2 | Documented below |
| Deferred / accepted risks | 3 | Documented below |

## Issues found and resolution

### 1. `pnpm install` failed with `EPERM` on Next SWC binary

| Field | Detail |
|-------|--------|
| Symptom | `EPERM: unlink ... @next/swc-win32-x64-msvc ... next-swc.win32-x64-msvc.node` |
| Cause | Local Next.js processes on ports **3000 / 3001** held the native binary during `node_modules` recreate |
| Impact | Incomplete `node_modules`; `turbo` missing → lint/test/build failed with “turbo is not recognized” |
| Fix | Stopped listeners holding the lock, completed `pnpm install --frozen-lockfile` |
| Code change | None |

### 2. `pnpm install` skipped `devDependencies` under `NODE_ENV=production`

| Field | Detail |
|-------|--------|
| Symptom | Install succeeded partially; `husky` / `turbo` missing; `prepare` script failed |
| Cause | Verification shell had `NODE_ENV=production`, so pnpm skipped root `devDependencies` |
| Impact | Same as above — workspace scripts unusable |
| Fix | Unset `NODE_ENV` for install; use `NODE_ENV=production` **only** for `pnpm build` |
| Code change | None (operator/env discipline) |

### 3. Docker Compose build not executable

| Field | Detail |
|-------|--------|
| Symptom | `docker` command not found |
| Cause | Docker Desktop / CLI not installed on the verification host |
| Impact | Cannot run `docker compose build` |
| Fix | Skipped with structural compose validation; document in BUILD_VERIFICATION_REPORT |
| Code change | None |

### 4. Kubernetes manifest CLI validation unavailable

| Field | Detail |
|-------|--------|
| Symptom | `kubectl` not found |
| Cause | kubectl not installed on the verification host |
| Impact | Cannot run `kubectl kustomize` |
| Fix | Structural scan of all `infrastructure/k8s/**/*.yaml` files |
| Code change | None |

## Application code review (this pass)

Automated gates already enforce:

- ESLint (unused imports/vars, consistent type imports, etc.)
- TypeScript (`tsc --noEmit` via `pnpm typecheck` + Nest/Next builds)
- Unit + mocked integration tests (including Alchemy providers)

**No additional application source patches were required** to clear lint/test/build/typecheck after install recovery.

## Deferred / known (not fixed here — out of safe scope)

| Item | Reason |
|------|--------|
| OpenTelemetry high/moderate advisories (`pnpm audit --prod`) | Requires coordinated OTEL major upgrades across services; accepted in prior release audits |
| Withdrawal path still balances via simulator ledger when Alchemy is live | Behavioral change; deferred to a dedicated follow-up (documented in Phase 17) |
| Live `/health/providers` against real Alchemy | Needs Postgres + Redis + `ALCHEMY_*` env; infrastructure was down during this pass |

## Residual errors after fixes

**None blocking.** Workspace lint, test, build, and typecheck all exit 0.
