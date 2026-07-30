# 04 — Remediation Plan

## Objective

Close every **Critical** risk before any public beta or GA recommendation. No parallel “feature sprint” to feel launch-ready.

**Owner cadence:** Weekly P0 standup until exit criteria met.  
**Evidence standard:** Links, screenshots, tickets, reports — not verbal assurance.

---

## P0 — Must close before public beta / GA (ordered)

| #   | Work                                                                                 | Owner hat     | Exit evidence                                                                              | Risks closed |
| --- | ------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------ | ------------ |
| 1   | Live broadcast + buy/sell/swap providers; **simulators false** in production configs | CTO           | Staging smoke + prod config review showing simulators off; successful live path on staging | R1           |
| 2   | Counsel publish Privacy & Terms; wire production URLs                                | Counsel + CEO | Live legal URLs; remove GA draft-only disclaimer on published pages                        | R2           |
| 3   | Replace `auvora.example` with production support & security contacts                 | CX + Ops      | Working inboxes + Help/Privacy updated                                                     | R3           |
| 4   | Admin SSO for operator access                                                        | CISO + Eng    | SSO login path; password-only admin disabled in prod                                       | R4           |
| 5   | External pen-test + remediation of Critical/High findings                            | CISO          | Signed report + tracker to closed/accepted residual                                        | R5           |
| 6   | Rotate all production secrets from templates                                         | Infra + CISO  | Rotation checklist signed; no template secrets in prod                                     | R5           |
| 7   | CSP enforce plan (Report-Only → Enforce)                                             | Eng + CISO    | Schedule + first enforce env                                                               | R5           |
| 8   | Restore drill ≤ policy window; backup failure + cert expiry alerts                   | Infra         | Drill record SUCCEEDED; alert test fired                                                   | R6           |
| 9   | Complete `PUBLIC_LAUNCH_CHECKLIST` to board threshold (≥90% critical items)          | Infra + Ops   | Checklist with dates/owners                                                                | R7           |
| 10  | Public status host + on-call routing                                                 | Infra + Ops   | `status.` URL + paging test                                                                | R7           |

**Estimated critical path:** 8–16 weeks depending on provider contracts, counsel, and pen-test scheduling — not a weekend.

---

## P1 — Before GA (can trail public beta only if beta stays invite-closed)

| #   | Work                                                                  | Owner            | Why                                  |
| --- | --------------------------------------------------------------------- | ---------------- | ------------------------------------ |
| 11  | E2E critical journeys + Lighthouse CI budgets                         | Eng / QA         | Evidence for performance/a11y claims |
| 12  | WCAG automated suite + manual AA sample                               | Design + Eng     | Accessibility board YES              |
| 13  | Support ticket domain or remove demo Support from prod admin IA       | Ops              | R10                                  |
| 14  | ConfirmSheet / consistent destructive confirms                        | Eng              | Operator safety                      |
| 15  | Email + notification brand template kit                               | CX + Eng         | R15                                  |
| 16  | Freeze marketing to preview until GO; legal review of all public copy | Growth + Counsel | R8                                   |

---

## P2 — After GO (not launch blockers)

| #   | Work                                                    |
| --- | ------------------------------------------------------- |
| 17  | Documentation prune / archive root report sprawl        |
| 18  | Full i18n message catalogs                              |
| 19  | RTL layout program                                      |
| 20  | Native wrappers (only after retail GO)                  |
| 21  | Customer-facing enterprise SSO (beyond admin operators) |

---

## Explicitly out of scope for remediation

- New speculative product lines
- Claiming AI financial advice
- App Store / Play submission of a demo wallet
- Selling enterprise/institutional packages

---

## Exit: flip to GO

When P0 rows 1–10 are evidenced and the executive board signs `02_Go_No_Go_Decision.md` as amended **GO**, then and only then:

1. Public beta may be considered (still gated messaging)
2. GA may follow after P1 store/perf/a11y evidence
3. Enterprise / institutional remain **separate programs** with additional gates (see Roadmap)

---

## Accountability

| If delayed…    | Do not…                        |
| -------------- | ------------------------------ |
| Providers slip | Ship public beta on simulators |
| Counsel slips  | Soft-launch with draft legal   |
| Pen-test slips | “Launch and fix later”         |
| SSO slips      | Expand admin operator count    |

Honesty over schedule.
