# 04 — Security Review

## Critical

| Finding                                               | Status                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| localStorage JWT for admin                            | **Mitigated in UX** (local-only warning); **not** production auth |
| Unguarded MFA disable / force logout / elevated roles | **Fixed** with confirms                                           |
| Feature flags as silent kill switches                 | **Fixed** with confirm + env callout                              |
| Public maintenance notices irreversible from UI       | **Fixed** End notice                                              |
| Support linking fake IDs into live identity API       | **Fixed**                                                         |

## Residual

1. Production must replace paste-JWT with IdP / httpOnly admin sessions.
2. XSS on admin still implies token theft while localStorage auth exists.
3. Security Center ≠ SIEM — documented.
4. Audit export/CSV still missing for compliance packs.

## Trust signals

Operators now see explicit scope banners. Destructive actions ask before firing. Demo surfaces no longer masquerade as live identity.
