# Technical Debt — Auvora Wallet (Task 037)

**Date:** 2026-07-27  
**Supersedes summary for launch ops:** consolidates Phase 15 [`TECHNICAL_DEBT_REPORT.md`](./TECHNICAL_DEBT_REPORT.md) with launch findings  
**Rule:** Debt here is **non-blocking for closed beta** unless marked GA-blocker

---

## GA blockers (ops + product honesty)

| ID   | Item                               | Severity | Notes                                                       |
| ---- | ---------------------------------- | -------- | ----------------------------------------------------------- |
| GA-1 | Public launch checklist incomplete | High     | DNS, TLS, secrets, pen-test, legal                          |
| GA-2 | Live auth/wallet mesh soak         | High     | Staging Postgres + full processes                           |
| GA-3 | CSP enforce                        | Medium   | Still Report-Only                                           |
| GA-4 | Demo-backed UX pockets             | Medium   | Portfolio labeled; settings/security still preview-oriented |

---

## High priority engineering debt

| ID    | Area       | Description                                               | Effort |
| ----- | ---------- | --------------------------------------------------------- | ------ |
| TD-H1 | Auth UX    | Full login/register web flows (beyond access-token panel) | M      |
| TD-H2 | Sessions   | Migrate JWT out of `localStorage` → httpOnly              | M      |
| TD-H3 | Gateway RL | Redis-backed multi-replica rate limit                     | M      |
| TD-H4 | Platform   | Shared Nest common (health, CSRF, publishers)             | L      |
| TD-H5 | Admin UX   | Route-level loading/error shells parity with web          | M      |
| TD-H6 | E2E        | Add e2e packages for nft/staking/connections/bridge       | M      |
| TD-H7 | OTEL       | Coordinated OpenTelemetry upgrade (audit highs)           | M      |
| TD-H8 | Contracts  | Generate SDK/OpenAPI from Nest to prevent drift           | L      |

---

## Medium priority

| ID    | Area             | Description                                                       |
| ----- | ---------------- | ----------------------------------------------------------------- |
| TD-M1 | Frontend         | Split `connections/page.tsx` (~753 lines)                         |
| TD-M2 | Portfolio        | Replace demo holdings with live wallet balances                   |
| TD-M3 | Settings         | Remove advanced/privacy placeholders or gate behind feature flags |
| TD-M4 | Database         | Pool helper adoption on all DB-heavy services                     |
| TD-M5 | CI               | Fail CI on new high severity audit findings                       |
| TD-M6 | Field encryption | Consolidate duplicated adapters                                   |
| TD-M7 | A11y             | Expand beyond smoke to axe/Playwright matrix                      |
| TD-M8 | Terraform        | Replace stub modules with live cloud providers                    |

---

## Low priority

| ID    | Description                                                |
| ----- | ---------------------------------------------------------- |
| TD-L1 | Empty Jest scaffolding in web/admin or add component tests |
| TD-L2 | Archive one-shot `scripts/generate-*.mjs` generators       |
| TD-L3 | Unify presentation folder naming (`http` vs `controllers`) |
| TD-L4 | Document port bands (4xxx gateway/auth vs 3xxx domains)    |

---

## Resolved (do not reopen without regression)

| ID  | Item                                       |
| --- | ------------------------------------------ |
| RB1 | Wallet fail-open address validation        |
| RB3 | Unauthenticated `/metrics/resilience`      |
| RB4 | Stale Next `.next` build flake mitigations |

---

## Debt policy for launch

1. Closed beta may ship with GA-1…GA-4 tracked and disclosed
2. Public GA requires GA-1…GA-3 closed; GA-4 minimized
3. No drive-by refactors during incident response
