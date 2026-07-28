# Security Audit — RC1 (Task 035)

**Date:** 2026-07-27  
**Scope:** Authentication, authorization, sessions, CSRF, XSS, CSP, headers, secrets, rate limiting, supply chain posture  
**Verdict:** **Security Status — Hardened (RC1)** · CSP enforcement deferred to edge/GA

## Summary score

| Domain | Rating | Notes |
|--------|--------|-------|
| AuthN / AuthZ | Strong | JWT + RBAC; CSRF on auth mutations |
| Session handling | Strong | Refresh families; device binding architecture |
| Edge headers | Strong | Helmet + `@auvora/security` SECURITY_HEADERS |
| CSP | Deferred | Recommended string exported; not enforced |
| Rate limiting | Strong (single-node) | Gateway fixed-window; Redis-backed multi-node Planned |
| Secrets / env | Improved | `.env.example` RC checklist + placeholders |
| Dependencies | Acceptable | No critical blockers in prior SECURITY_REVIEW; OTEL highs accepted |

## Controls verified

### Authentication & sessions
- Login / register / refresh / logout via auth service  
- CSRF double-submit (`csrf_token` cookie + `x-csrf-token`) on state-changing auth routes  
- Access + refresh cookie names centralized in `@auvora/security`  
- Account lockout + auth rate limits via env (`LOCKOUT_*`, `RATE_LIMIT_*`)

### Authorization
- Role / permission guards across services  
- Gateway denies `/api/v1/internal/**` from public edge  
- `/metrics/resilience` requires `x-internal-api-key` when key set or `NODE_ENV=production`

### XSS / headers
| Header | Gateway | Next web/admin |
|--------|---------|----------------|
| X-Content-Type-Options | nosniff | nosniff |
| X-Frame-Options | DENY | DENY (prod only; omitted in local next dev so IDE/Cursor previews can embed) |
| Referrer-Policy | no-referrer | no-referrer |
| Permissions-Policy | camera/mic/geo disabled | same |
| COOP / CORP | same-origin / same-site | same (prod) |
| HSTS | On in production (prefer edge) | Not set (TLS terminator) |
| CSP | Off (documented) | Off (documented) |

### CSRF
- Enforced in auth and domain Nest presentation modules via `CsrfGuard`  
- Not duplicated on gateway (proxies preserve cookies/headers)

### Input validation
- Zod env schemas per service  
- DTO / class-validator on Nest controllers  
- Fail-closed address validation when blockchain URL unset (prior RC fix)

### Secret handling
- `.env.example` marked LOCAL ONLY; openssl generate guidance  
- Field encryption keys normalized to `<generate-with-openssl-rand-hex-32>`  
- `COOKIE_SECURE` production warning documented  
- `redactSensitive` / `assertNonEmptySecret` helpers available

### Rate limiting & replay
- Gateway: `FixedWindowRateLimiter` (in-memory)  
- Auth lockout for brute force  
- Refresh token rotation / family revocation model in auth domain

## RC1 changes
1. Probe-compatible `/ready` → **503** when auth unreachable  
2. `CONTENT_SECURITY_POLICY_RECOMMENDED` export for edge rollout  
3. Env template + HSTS/CSP operational notes  

## Findings — accepted / deferred

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| S-CSP | Medium | CSP not enforced in apps | Deferred — edge report-only then enforce |
| S-JWT-LS | Medium | Demo JWT often in localStorage | Deferred — httpOnly migration |
| S-RL-REDIS | Low | Gateway RL not shared across replicas | Deferred — Redis limiter |
| S-XFF | Low | Rate limit trusts first XFF hop | Documented — strip at reverse proxy |
| S-OTEL | Low | OTEL dependency highs | Accepted for RC1 |

## Supply chain
- pnpm lockfile committed; overrides for known vulnerable transitive ranges  
- Private packages; no unexpected public publish scripts in apps  

## Recommendations for GA
1. Enable CSP-Report-Only at ingress using `CONTENT_SECURITY_POLICY_RECOMMENDED`  
2. Migrate web access token to httpOnly cookie + CSRF  
3. Require `INTERNAL_API_KEY` in production env schema refine  
4. Pen-test + dependency audit gate from FINAL_RELEASE_CHECKLIST
