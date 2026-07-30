# 03 — Enterprise Security

## Posture (existing)

| Control                | Location                                    |
| ---------------------- | ------------------------------------------- |
| JWT + refresh cookies  | `packages/security`, auth service           |
| RBAC roles/permissions | `@Roles` / `@Permissions`, seed codes       |
| Rate limiting          | Gateway fixed-window + Redis limiters       |
| Security headers       | Helmet / CSP report-only middleware         |
| Audit trail            | `SecurityAuditLog` + admin audit API        |
| Sessions               | Force-logout, revoke all                    |
| Wallet security UX     | Consumer apps (never collect keys in admin) |

## Phase 8 concrete improvements

1. **Admin accounts + RBAC UI** — search, status, roles, MFA toggle, force logout via live APIs.
2. **Audit log UI** — filter by action / actor; renders immutable auth audit rows.
3. **Security center** — surfaces critical / security-tagged ops alerts with links to compliance and full alert center.
4. **SDK coverage** — `adminSearchUsers`, `adminListAudit`, role/status/MFA/logout methods (were controller-only).

## Messaging & validation

- Admin never displays secrets (feature flag page copy + settings page).
- Support templates emphasize fee/network truthfulness and verification language (demo).
- Demo support actions explicitly do not persist and do not fake security approvals.

## Documented gaps (honest)

| Gap                   | Notes                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Paste-JWT admin auth  | Fine for local/dev; production needs IdP / short-lived admin sessions               |
| Dependency scanning   | Exists in CI docs — not re-implemented here                                         |
| Encryption at rest    | Platform/cloud responsibility — see `docs/SECURITY_HARDENING.md`                    |
| Tx verification hooks | Domain services; admin monitors via blockchain/compliance, does not approve blindly |

## References

`docs/SECURITY_GUIDE.md`, `docs/SECURITY_HARDENING.md`, `docs/SECURITY_AUDIT.md`, Phase 8 `10_Security_Audit.md`.
