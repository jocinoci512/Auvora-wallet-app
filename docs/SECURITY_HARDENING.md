# Security Hardening

Last updated: **2026-07-26** (v1.0.0-rc.1)

## Controls reviewed

| Area | Status | Notes |
|------|--------|-------|
| Authentication | Retained | JWT + refresh cookies + argon2 |
| Authorization / RBAC | Retained | Roles + permissions guards |
| Secrets | Hardened | External Secrets (Phase 12) + `@auvora/secrets` + redaction helpers |
| HTTP headers | Improved | Helmet + COOP/CORP + Permissions-Policy + HSTS (prod) + Next headers |
| CSRF | Retained | Double-submit cookie/header |
| CORS | Retained | Explicit origin allow-list + credentials |
| Rate limiting | Improved | Gateway edge limiter + existing auth Redis limiter |
| Input validation | Retained | Zod / class-validator DTOs |
| Proxy hardening | Retained | Strip internal keys; forward correlation/trace; 30s proxy timeouts |
| Container hardening | Retained | Non-root, dropped caps (Phase 12) |
| TLS | Retained | Ingress TLS + rate limit annotations |
| Audit logging | Retained | Domain audit tables |
| Token security | Retained | Hashed refresh tokens; denylist |
| Key rotation readiness | Documented | Secrets providers + ExternalSecret refreshInterval |

## Dependency / supply chain (ERV)

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm audit --prod` | **0 critical**; **5 high** remaining | 4 OTEL + 1 brace-expansion advisory-range false positive (see below) |
| Remediations applied | **PASS** | Overrides: `nodemailer@9.0.1`, `sharp@0.35.0`, `postcss@8.5.18`, `js-yaml@5.2.2`, major-scoped `brace-expansion` (`1.1.16` / `2.0.2` / `5.0.8`) |
| Brace-expansion pin | **Scoped by major** | Global `5.x` broke ESLint/`minimatch@3` (`expand is not a function`) |
| Gitleaks / Trivy / Cosign | Retained in CI | Unchanged from Phase 12/13 |

Local:

```bash
pnpm audit --prod --audit-level=high
```

### Accepted risk — OpenTelemetry highs

| Package family | Advisory theme | Why deferred |
|----------------|----------------|--------------|
| `@opentelemetry/auto-instrumentations-node` (&lt;0.75) | Prometheus exporter crash class | Bumping requires coordinated `sdk-node` ≥0.217 across all Nest services — breaking API |
| `@opentelemetry/propagator-jaeger` (&lt;2.9) | Propagator hardening | Tied to sdk-trace-node 1.30.x line |
| `@opentelemetry/exporter-prometheus` / `sdk-node` | Same upgrade train | Track as Phase 14+ dependency modernization |

Mitigation until upgrade: metrics scrape isolation, non-prod default exporters, and service health/ready probes independent of Prometheus exporter process crashes.

### brace-expansion advisory note

npm advisory range `<=5.0.7` also matches patched **1.1.16** (semver). Workspace resolves `1.1.16` (minimatch@3), `2.0.2` (minimatch@9), and `5.0.8` (minimatch@10). Treat the residual “high” as a **range false positive** against the 1.x line; do not force global 5.x onto ESLint.

## Session / cookie posture

- `httpOnly` refresh cookies (auth service)
- CSRF required on cookie-authenticated mutating routes
- No secrets in frontend bundles

## Recommendations (operational)

1. Keep `GATEWAY_RATE_LIMIT_MAX` tuned per environment under load.
2. Enforce HSTS only behind TLS terminators.
3. Rotate `JWT_*` and `INTERNAL_API_KEY` via External Secrets quarterly (DR runbook).
4. Treat new **critical** `pnpm audit` findings as release blockers; OTEL highs tracked above.
5. Ensure Postgres is healthy before auth journey certification (`auth /ready` → `database: ok`).
