# 02 — Go / No-Go Decision

## Decision

# NO GO — Public launch

Auvora Wallet is **not approved** for unrestricted public beta, general availability, enterprise partnership launch, or institutional user onboarding.

Invite-only **closed beta / staging preview** remains **conditionally approved** when simulators and preview language are explicit.

---

## Answers to the board questions

| Question                     | Decision  | Rationale                                                                                                                                                          |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Public Beta?**             | **NO GO** | Public beta implies open signup and perceived live product. Live rails, published legal, and real support are not closed. (Invite-only closed beta ≠ public beta.) |
| **General Availability?**    | **NO GO** | `PUBLIC_LAUNCH_CHECKLIST` incomplete; P0 security/ops/legal open.                                                                                                  |
| **Enterprise Partnerships?** | **NO GO** | Admin SSO, audit posture, SLAs, and contractual trust surfaces missing. Pilot NDAs only with labeled preview — not partnership launch.                             |
| **Institutional Users?**     | **NO GO** | Institutional bar exceeds retail GA; custody/compliance/ops evidence absent.                                                                                       |

---

## Sign-off matrix

| Seat              | Closed beta (invite) | Public beta | GA        | Enterprise | Institutional |
| ----------------- | -------------------- | ----------- | --------- | ---------- | ------------- |
| CEO               | Conditional YES      | NO          | NO        | NO         | NO            |
| CPO               | YES (honesty labels) | NO          | NO        | NO         | NO            |
| CTO               | YES (staging)        | NO          | NO        | NO         | NO            |
| CDO               | YES                  | NO*         | NO*       | NO         | NO            |
| CISO              | Conditional          | NO          | NO        | NO         | NO            |
| CX                | Conditional          | NO          | NO        | NO         | NO            |
| Eng / Infra / Ops | YES / Conditional    | NO          | NO        | NO         | NO            |
| Growth            | Soft freeze          | NO          | NO        | NO         | NO            |
| **Board**         | **Preview OK**       | **NO GO**   | **NO GO** | **NO GO**  | **NO GO**     |

\*Design craft is strong; launch decision is blocked by non-design P0s.

---

## What “GO” would require (non-negotiable)

All of the following, with written evidence — not slides:

1. Production provider simulators **false**; live send/swap/buy/sell paths verified on staging→prod promote path
2. Counsel-published Privacy Policy & Terms (replace draft disclaimer for GA surfaces)
3. Production support@ and security@ (or equivalent) — no `auvora.example`
4. Admin SSO enabled for operators
5. Pen-test sign-off + secrets rotated from templates + CSP enforce plan
6. Restore drill within policy window + backup failure alerts
7. Substantial completion of [`docs/PUBLIC_LAUNCH_CHECKLIST.md`](../../PUBLIC_LAUNCH_CHECKLIST.md)
8. Executive re-review issues a written **GO**

Until then, any marketing that implies production settlement wallet is **prohibited**.

---

## Distinctions the board insists on

| Term                   | Meaning for Auvora                                |
| ---------------------- | ------------------------------------------------- |
| Closed beta            | Invite list, preview labeling, known limitations  |
| Public beta            | Open or lightly gated public access — **blocked** |
| GA                     | Stores, growth, unrestricted — **blocked**        |
| Enterprise partnership | Contracted B2B with SSO/SLA — **blocked**         |
| Institutional          | Regulated / large AUM posture — **blocked**       |

---

## Re-review trigger

Return to this board with Remediation Plan P0 closed and checklist evidence attached. Until then: **NO GO** for all public and institutional programs.
