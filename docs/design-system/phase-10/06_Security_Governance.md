# 06 — Security Governance

## Mission

Security is a **company process**, not only a feature screen. Users see Security Center and Trust; operators use admin RBAC, audit logs, and release controls.

## Internal practices

| Practice              | Expectation                                                    |
| --------------------- | -------------------------------------------------------------- |
| Administrative access | RBAC + permissions; admin SSO is **P0** before GA              |
| Key management        | Custody boundary; keys never in frontend or support            |
| Secrets               | `@auvora/secrets`, External Secrets; rotate from templates     |
| Audit logs            | Admin audit APIs live; retain per policy                       |
| Release approvals     | Conventional commits + CI; production promote needs human gate |
| Deployment approvals  | Staging GO ≠ production GO; checklist ownership                |
| Risk management       | Phase 9 risk register + PUBLIC_LAUNCH_CHECKLIST                |

## User trust surfaces

- `/settings/security` — actionable hygiene
- `/trust` — how we talk about risk and incidents
- `/legal/privacy` — draft collection principles
- Honesty banners on money flows

## Forbidden (governance)

- Pasting long-lived JWTs into UI for “convenience” in production builds
- Claiming pen-test complete without report
- Shipping with simulators true while marketing live settlement

## P0 security close list (unchanged from Phase 9)

1. Live rails + simulators false
2. Published legal + real support/security contacts
3. Admin SSO
4. Pen-test + secrets rotation + CSP enforce plan
5. Restore drill / backup alerts

## Gate

**Security governance: Conditional** — engineering controls strong; **SSO, pen-test, and published legal** block public GA.
