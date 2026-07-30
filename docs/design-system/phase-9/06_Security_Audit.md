# 06 — Security Audit

## Phase 9 security polish

| Topic                               | Status                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| Fake broadcast / buy / sell success | **Fixed** — preview only                                   |
| Device revoke without API           | **Fixed** — no-op + message                                |
| Biometrics theater                  | **Fixed** — preference wording                             |
| AccessTokenPanel in production UI   | **Hidden** (`NODE_ENV === 'production'`)                   |
| Admin Support demo in prod nav      | **Hidden**                                                 |
| JWT in localStorage                 | Residual — staging only; IdP still required for prod admin |

## Unchanged solid posture (prior phases)

- No recovery phrase in Assistant
- Health score / insights educational
- Admin destructive confirms (Phase 8 review)
- Auth RBAC on gateway

## Before GA

1. Enforce CSP / security headers in edge
2. Pen-test money paths with live signing
3. Replace paste-JWT entirely
4. Dependency audit in CI

## Verdict

**Conditional pass** for staging preview. Production security still gated on IdP + live signing.
