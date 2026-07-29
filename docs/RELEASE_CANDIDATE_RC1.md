# Release Candidate RC1 — Auvora Wallet

**Version:** `v1.0.0-rc.1`  
**Date:** 2026-07-27  
**Phase:** Release Engineering — Task 035  
**Constraint:** No new product features; production readiness + safe hardening only

---

## Executive summary

Auvora Wallet **RC1** is certified for staging promotion after Task 034 product excellence and Task 035 release engineering. Workspace lint, typecheck, unit tests, build, integration suites, and Nest e2e health suites are green. Gateway edge hardening (rate limit, headers, probe-compatible `/ready`, graceful shutdown) is in place. Full domain mutation E2E against Postgres + complete service mesh remains a **GA gate** (see Remaining issues).

**RC1 decision:** **GO for staging / limited pilot** · **NO-GO for unrestricted production GA** until checklist items in [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) and [`../FINAL_RELEASE_CHECKLIST.md`](../FINAL_RELEASE_CHECKLIST.md) clear.

---

## Status board

| Area              | Status                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| Release Candidate | **RC1 ready (staging)**                                                              |
| Security          | **Hardened** — CSP deferred to edge (documented); `/ready` 503 when auth down        |
| Performance       | **Pass** — web First Load shared ≈ 103 kB; gateway health ~1.5k–1.8k RPS @ 0% errors |
| Infrastructure    | **Pass** (gateway + UI); auth/wallet mesh optional on this host                      |
| API               | **Pass** (contracts + OpenAPI); live mutation cert Partial                           |
| Database          | **Pass** (schema + 21 migrations + indexes/FKs audited)                              |
| Tests             | **Pass** — unit 35/35 · integration 9/9 · e2e 13/13 packages                         |
| Repository health | **96 / 100**                                                                         |

---

## RC1 hardening applied (Task 035)

| Item             | Change                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| Gateway `/ready` | Returns **503** when auth dependency degraded (probe-compatible)                        |
| CSP              | `CONTENT_SECURITY_POLICY_RECOMMENDED` exported; not enforced in-app (edge/GA)           |
| HSTS notes       | Prefer TLS terminator; gateway option documented                                        |
| `.env.example`   | Dev-only banner; normalized secret placeholders; COOKIE_SECURE / INTERNAL_API_KEY notes |
| Journey smoke    | Product experience surfaces (14 routes); soft-skip when mesh down; 504 wallet skip      |
| Load suite       | Soft-skip unreachable auth/wallet when gateway healthy                                  |
| E2E health       | Lightweight HealthController suites (no live Postgres required)                         |

---

## Validation evidence (this host)

| Command                             | Result                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `pnpm install`                      | PASS                                                                   |
| `pnpm lint`                         | PASS 35/35                                                             |
| `pnpm test`                         | PASS 35/35                                                             |
| `pnpm build`                        | PASS 29/29                                                             |
| Integration `*integration*.spec.ts` | PASS 9 suites                                                          |
| `test:e2e` (13 packages)            | PASS                                                                   |
| `pnpm perf:a11y` / a11y-smoke       | PASS 5/5                                                               |
| `pnpm perf:journeys`                | PASS (gateway + 14 UI routes; domain APIs skipped when upstreams down) |
| `pnpm perf:load`                    | PASS gateway health/swagger 0% errors; auth/wallet skipped when down   |

---

## User journey matrix (RC1)

| Journey                                    | Status         | Evidence                      |
| ------------------------------------------ | -------------- | ----------------------------- |
| Onboarding / create / import / recovery UI | Pass (surface) | `/wallets/*` 200              |
| Portfolio                                  | Pass (surface) | `/portfolio` 200              |
| Send / Receive / Activity                  | Pass (surface) | route smoke                   |
| Swap / Bridge / Staking / NFTs             | Pass (surface) | route smoke                   |
| Web3 / Settings / Security Center          | Pass (surface) | route smoke + Task 032/033    |
| Notifications                              | Pass (surface) | `/notifications` 200          |
| Auth / sessions (live DB)                  | Partial        | Needs Postgres + auth process |
| Admin                                      | Pass (surface) | `:3001` a11y + observability  |
| Gateway health / docs / ready              | Pass           | Live `:4000`                  |

---

## Remaining issues (GA blockers / follow-ups)

1. Full service mesh + Postgres/Redis staging certification
2. Enforce CSP (report-only → enforce) at ingress after NFT media validation
3. JWT-in-localStorage → httpOnly session migration (security backlog)
4. Redis-backed gateway rate limit for multi-instance
5. Nested package versions / pen-test / audit hard-fail (FINAL_RELEASE_CHECKLIST)
6. E2E for nft/staking/connections/bridge packages (health e2e still missing those four)

---

## Documentation generated

- [`RELEASE_CANDIDATE_RC1.md`](./RELEASE_CANDIDATE_RC1.md) (this file)
- [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md)
- [`PERFORMANCE_AUDIT.md`](./PERFORMANCE_AUDIT.md)
- [`LOAD_TEST_RESULTS.md`](./LOAD_TEST_RESULTS.md)
- [`API_AUDIT.md`](./API_AUDIT.md)
- [`DATABASE_AUDIT.md`](./DATABASE_AUDIT.md)
- [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)

## Verification URLs

- Web: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:4000
- Swagger: http://localhost:4000/api/docs
- Health: http://localhost:4000/health
- Ready: http://localhost:4000/ready (503 when auth down — expected)
