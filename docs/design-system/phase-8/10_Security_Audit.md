# 10 — Security Audit (Phase 8 scope)

## In scope

Admin surfaces and SDK methods added/extended in Phase 8, plus review of existing enterprise controls.

## Strengths

- Fine-grained permission codes on admin controllers.
- Audit logging for status/roles/MFA/logout mutations.
- Feature flag UI does not expose secrets.
- Support demo cannot approve compliance or custody actions.
- Security headers and rate limiting remain at gateway (unchanged, still valid).

## Findings

| ID   | Severity | Finding                                                          | Status                                       |
| ---- | -------- | ---------------------------------------------------------------- | -------------------------------------------- |
| P8-1 | Medium   | Admin auth via long-lived pasted JWT in localStorage             | Accepted for local; production needs IdP     |
| P8-2 | Low      | Role assignment UI allows selecting `super_admin` if API permits | Server still enforces `roles:manage`         |
| P8-3 | Low      | Maintenance create lacks deactivate UI                           | Create-only; operators use API/DB for cancel |
| P8-4 | Info     | Support demo looks operational                                   | Mitigated with warn alerts + docs            |
| P8-5 | Info     | Security alert filter is keyword/severity heuristic              | Not a substitute for dedicated SIEM          |

## Remediations shipped

- Audit log visibility for operators.
- Force-logout and MFA controls in UI.
- Explicit non-persistence messaging on support actions.

## Residual gaps

See `docs/SECURITY_HARDENING.md` for encryption, pen-test, and dependency cadence. Phase 8 does not claim SOC2 completion.
