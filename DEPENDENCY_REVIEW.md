# Dependency Review

**Audit date:** 2026-07-26  
**Phase:** 15 — Enterprise Repository Audit  
**Tooling:** `pnpm audit --prod`, root `pnpm.overrides`, `.github/workflows/security-scan.yml`

## Score: **7.9 / 10**

Production audit is **0 critical**. Remaining highs are OpenTelemetry family (accepted for RC). Overrides pin known transitive issues without breaking ESLint.

## Audit result (this pass)

```
7 vulnerabilities found
Severity: 2 moderate | 5 high
Critical: 0
```

| Class | Count | Disposition |
|-------|------:|-------------|
| Critical | 0 | — |
| High | 5 | OTEL / related transitive — **accepted** for v1.0.0-rc.1 |
| Moderate | 2 | Track with OTEL upgrade |
| Low | 0 | — |

## Root overrides (active)

| Package | Pin | Rationale |
|---------|-----|-----------|
| `brace-expansion` (major-scoped) | 1.1.16 / 2.0.2 / 5.0.8 | Advisory range FP; avoid global 5.x on ESLint |
| `postcss` | 8.5.18 | Known advisory |
| `js-yaml` | 5.2.2 | Known advisory |
| `nodemailer` | 9.0.1 | Known advisory |
| `sharp` | 0.35.0 | Known advisory |

## Workspace inventory

| Area | Packages | Notes |
|------|----------|-------|
| Apps | web, admin, docs | Next 15 / React 19 |
| Services | 11 Nest services | Gateway + domain + observability |
| Shared | types, database, security, sdk, ui, config, cache, secrets, resilience | cache/secrets incubating |
| Database package | `database/` | Prisma schema + seed |

## Findings

### High

| ID | Finding | Status |
|----|---------|--------|
| D-H1 | OTEL highs block hard-fail audit | Accepted + upgrade plan |
| D-H2 | Security workflow soft-fails audit (`\|\| true`) | Open (TD-M5) |

### Medium

| ID | Finding |
|----|---------|
| D-M1 | Nested workspace versions `0.1.0` vs root `1.0.0-rc.1` |
| D-M2 | Unused incubating packages still published in workspace graph |
| D-M3 | ts-jest `isolatedModules` deprecation warnings across Nest tests |

### Low

| ID | Finding |
|----|---------|
| D-L1 | Next ESLint plugin not in docs eslint config (build warning only) |

## CI posture

| Workflow | Behavior |
|----------|----------|
| `ci.yml` | Lint, typecheck, test, build; PR dependency-review fail-on-high; gitleaks |
| `security-scan.yml` | `pnpm audit --prod --audit-level=high \|\| true` |
| `image-scan.yml` / `sign-images.yml` | Image supply-chain (present) |

## Recommendations

1. OTEL coordinated upgrade; then remove audit soft-fail.  
2. Align nested package versions at GA tag.  
3. Keep major-scoped brace-expansion overrides (do not global-pin 5.x).  
4. Migrate ts-jest isolatedModules config before Jest 30.
