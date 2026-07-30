# 08 — Architecture Review

## Decision summary

| Decision                         | Rationale                                                     |
| -------------------------------- | ------------------------------------------------------------- |
| Extend existing admin + SDK      | Backend platforms already mature; UI was the bottleneck       |
| Admin-local Aether tokens        | Avoid breaking consumer web still on shared teal/paper tokens |
| Demo support console             | No ticket domain — preview IA without fake production metrics |
| Settings as hub, not new service | Flags + maintenance + infra already cover runtime control     |
| Keep AccessTokenPanel            | Local/dev admin auth; SSO is a separate production project    |

## Boundaries

```text
Consumer (web) ──► PlatformShell / Aether experiences (Phases 1–7)
Admin (admin) ──► Ops consoles ──► Gateway ──► Auth / Obs / Infra / Domains
Public status ──► Observability maintenance + incidents
```

Admin must not become a second wallet product UI. It operates platforms.

## Quality of existing platforms

| Platform              | Maturity                  |
| --------------------- | ------------------------- |
| Observability service | High                      |
| Infrastructure portal | High                      |
| Auth RBAC + audit     | High                      |
| Compliance / custody  | High (domain UIs thinner) |
| Support ticketing     | Absent (preview only)     |
| CMS                   | Absent                    |

## Risks accepted

- JWT paste panel increases foot-gun risk if admin is exposed publicly without network controls.
- Demo support could be mistaken for live unless warnings remain — keep Alert banners.
- Nav density remains high; further grouping can wait for usage data.
