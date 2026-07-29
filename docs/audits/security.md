# Security Report — Pre-Deployment Audit

**Date:** 2026-07-27  
**Constraint:** No secrets printed or committed

---

## Summary

| Area                                   | Status                                             |
| -------------------------------------- | -------------------------------------------------- |
| Secrets in git                         | **PASS** — only `*.example` env templates tracked  |
| Next security headers                  | **PASS (prod)** / embed-friendly **dev**           |
| Gateway CORS / rate limit / health     | **PASS** (rate limit in-memory residual)           |
| Auth / JWT patterns                    | **CONDITIONAL** — httpOnly migration still backlog |
| Dependency audit (`pnpm audit --prod`) | **CONDITIONAL** — 5 high / 2 moderate (OTEL)       |
| Pen-test                               | **PENDING**                                        |

**Security status: CONDITIONAL PASS for closed beta; HOLD for public GA**

---

## Findings

### Secrets management

- `.gitignore` ignores `.env`, `.env.local`, `.env.*.local`, `.env.staging`, `.env.production`
- Allows `.env.example`, `.env.staging.example`, `.env.production.example`
- Templates use placeholders only

### HTTP security headers (Next)

- Production: `X-Frame-Options: DENY`, COOP/CORP strict, CSP **Report-Only**
- Development: framing allowed for IDE previews

### Gateway

- CORS from `CORS_ORIGINS`
- In-memory rate limiter (skips `/health`, `/ready`)
- `/health` liveness; `/ready` 503 when auth/deps down

### Dependency vulnerabilities

`pnpm audit --prod`: **7** issues (2 moderate, 5 high), primarily `@opentelemetry/core` via auto-instrumentation. Accepted for RC soak; plan coordinated OTEL upgrade before GA.

### Residuals (do not auto-“fix” without product decision)

1. Enforce CSP at edge (leave Report-Only until observe window ends)
2. Prefer httpOnly cookies over `localStorage` JWTs
3. Redis-backed rate limits for multi-replica
4. External pen-test

---

## Safe changes this audit

- Expanded `.gitignore` for staging/production env files
