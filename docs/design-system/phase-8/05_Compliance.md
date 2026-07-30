# 05 — Compliance & Auditing

## Existing compliance product

Admin already operates KYC queue, AML alerts, cases, and rules under `/compliance/*` against live compliance APIs.

## Phase 8 additions

| Trail                  | Surface                                    | Source                            |
| ---------------------- | ------------------------------------------ | --------------------------------- |
| Security / admin audit | `/security/audit`                          | Auth `SecurityAuditLog`           |
| Ops audit              | Observability admin `GET .../audit`        | Available API; UI can be extended |
| Custody audit          | `/custody/audit`                           | Domain-scoped                     |
| Infra config history   | Feature flag updates + infra audit records | Infrastructure service            |
| Maintenance history    | `/observability/maintenance`               | Notice list                       |

## Policy & reporting

- Compliance policy engine: ADR `0002`.
- Security reporting remains via ops alerts + audit export (API list; CSV export not added).
- Incident history: `/observability/incidents` + public status page incidents.

## Gaps

- Dedicated compliance “policy document CMS” — not built.
- Cross-domain unified audit search — still per-domain.
- Legal hold / export workflows — documented as future work in ops guides.
