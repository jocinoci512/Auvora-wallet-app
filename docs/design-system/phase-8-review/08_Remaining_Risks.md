# 08 — Remaining Risks

## P0 before public production admin

1. **Admin SSO / httpOnly session** — replace paste-JWT
2. **Support ticket domain** — or remove Support from primary operate paths in prod builds
3. **SIEM / security event pipeline** — Security Center is a filter, not detection

## P1 before claiming enterprise ops maturity

4. Incident assign + escalate UI (APIs exist)
5. Audit export for compliance
6. ConfirmSheet design-system control instead of `window.confirm`
7. Unify remaining admin domains onto PageHeader + Aether tokens
8. On-call integrations (PagerDuty/Slack) and runbook deep links

## P2

9. Custom analytics charts on overview
10. CMS / content management (Settings already admits gap)
11. Nested `<main>` landmark cleanup

None of the above block **staging** use of users/RBAC/audit/flags/maintenance/triage after this follow-up.
