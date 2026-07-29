# Code Health Report — Pre-Deployment Audit

**Date:** 2026-07-27  
**Supersedes prior snapshot for gate metrics below**

---

## Health score: **91 / 100**

| Dimension           | Score | Weight | Notes                                    |
| ------------------- | ----: | -----: | ---------------------------------------- |
| Build / type safety |    98 |    20% | Lint, typecheck, build green             |
| Tests               |    94 |    20% | Unit + int + e2e green; UI Jest thin     |
| Security            |    82 |    20% | CSP RO, JWT storage, OTEL advisories     |
| Performance         |    92 |    10% | First Load ~103 kB; harnesses present    |
| Ops / deploy        |    88 |    15% | CD ready; prod gated; secrets one-time   |
| Maintainability     |    90 |    15% | Hexagonal Nest; Turbo monorepo; WIP debt |

Weighted ≈ **91**.

---

## Strengths

- Consistent Nest hexagonal layout and shared packages
- Prisma migrations present (21)
- CI/CD + Vercel monorepo configs committed
- Preview/prod Next hygiene scripts

## Deductions

| Points | Reason                                                    |
| -----: | --------------------------------------------------------- |
|     −4 | Security residuals (CSP, JWT localStorage, rate-limit HA) |
|     −2 | `pnpm audit` high OTEL advisories                         |
|     −2 | Large uncommitted working tree outside last deploy commit |
|     −1 | Thin web/admin unit tests                                 |

---

## Safe remediation done

- Env gitignore hardening
- CD deploy cancellation policy
- Prisma schema format + `validate` script

## Do not auto-change

- Enforce CSP without observe data
- Cookie session migration (product/security design)
- Broad OTEL major upgrade without soak

---

## Related

- [`FINAL_PRE_DEPLOYMENT_AUDIT.md`](./FINAL_PRE_DEPLOYMENT_AUDIT.md)
- [`KNOWN_PRODUCTION_LIMITATIONS.md`](./KNOWN_PRODUCTION_LIMITATIONS.md)
