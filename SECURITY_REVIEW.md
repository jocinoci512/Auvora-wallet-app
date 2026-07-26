# Security Review

**Audit date:** 2026-07-26  
**Phase:** 15 — Enterprise Repository Audit  
**Companions:** [`docs/SECURITY_HARDENING.md`](docs/SECURITY_HARDENING.md), [`docs/SECURITY_GUIDE.md`](docs/SECURITY_GUIDE.md)

## Score: **8.1 / 10**

RC closed fail-open address validation and unauthenticated resilience metrics. Remaining highs are accepted OTEL CVEs, JWT-in-localStorage posture, and CI audit soft-fail. No hardcoded production secrets found in source.

## Scorecard

| Area | Status |
|------|--------|
| Secrets in source | **Pass** — test passwords only; Helm production `secrets.create: false` + ExternalSecrets path |
| AuthN / sessions | **Pass** — Argon2, refresh families, CSRF guards on mutating Nest apps |
| AuthZ / RBAC | **Pass** — permission/role guards present across services |
| Internal API keys | **Pass** — `/metrics/resilience` requires key when configured / production |
| Input validation | **Pass** — Zod env schemas; DTO validation in Nest |
| Rate limiting | **Pass** — gateway fixed-window middleware |
| Security headers | **Pass** — gateway + Next apps (web/admin/docs) |
| Dependency CVEs | **Conditional** — 0 critical; 5 high (OTEL family) accepted for RC |
| SSRF (proxies) | **Pass** — targets from env service URLs; request hardening helpers |
| XSS / CSRF | **Partial** — CSRF guards server-side; JWT in `localStorage` elevates XSS blast radius |

## Findings

### Critical

None (RB1/RB3 resolved in v1.0.0-rc.1).

### High

| ID | Finding | Status |
|----|---------|--------|
| S-H1 | OpenTelemetry transitive highs (`pnpm audit --prod`: 5 high, 2 moderate) | **Accepted** — upgrade train post-RC |
| S-H2 | Access tokens stored in `localStorage` (web + admin) | **Open** — ADR or httpOnly cookie migration (TD-M4) |
| S-H3 | `security-scan.yml` runs `pnpm audit --prod --audit-level=high \|\| true` | **Open** — soft-fail hides new highs (TD-M5) |

### Medium

| ID | Finding |
|----|---------|
| S-M1 | Chart-local Secret template exists for non-prod; ensure prod never enables `secrets.create` |
| S-M2 | Permission seed vs full `PermissionCode` union drift risk |
| S-M3 | Field encryption adapters duplicated (key handling consistency risk) |

### Low

| ID | Finding |
|----|---------|
| S-L1 | Perf journey uses fixed test password (harness only) |
| S-L2 | Docs Next ESLint plugin warning during build (non-blocking) |

## Mitigations confirmed

- Wallet address validation fail-closed when blockchain URL unset.  
- Gateway rate limits + proxy timeouts.  
- Gitleaks + dependency-review on PRs (`.github/workflows/ci.yml`).  
- Production Helm values disable chart-embedded secrets.

## Recommendations

1. Coordinated OTEL major upgrade across all Nest services.  
2. ADR for browser token storage; prefer httpOnly + CSRF.  
3. Replace `\|\| true` on audit with allowlisted advisory IDs.  
4. Pen-test before Production GA.
