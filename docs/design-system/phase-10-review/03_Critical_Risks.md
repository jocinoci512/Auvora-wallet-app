# 03 — Critical Risks

## Risk methodology

Severity = impact × likelihood if launched publicly _as-is_.  
Only **Critical** and **High** are launch-blocking or near-blocking.

---

## Critical (launch-blocking)

| ID  | Risk                                                           | Impact                           | Why it blocks                                                                                   |
| --- | -------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| R1  | Users believe money moved when path is still simulator/preview | Catastrophic trust / regulatory  | Even with honesty banners, public GA traffic will miss labels; simulators must be false in prod |
| R2  | No counsel-published Privacy/Terms                             | Legal / regulatory               | Draft pages explicitly defer to counsel; GA without publish is indefensible                     |
| R3  | Placeholder support/security contacts                          | CX / security response           | Incidents and phishing reports go nowhere; users stuck                                          |
| R4  | Admin without SSO                                              | Insider / account takeover       | Operator surface for millions of users must not be password-demo grade                          |
| R5  | No pen-test / secrets rotation sign-off                        | Breach                           | Fintech launch without attested hardening is reckless                                           |
| R6  | Unproven backup restore / DR alerts                            | Permanence of outage / data loss | Docs ≠ drills; RPO/RTO unverified in practice                                                   |
| R7  | Incomplete public launch checklist                             | Cascading ops failure            | Infra, monitoring, CORS/HSTS, status host unchecked                                             |

---

## High (near-blocking / program-blocking)

| ID  | Risk                                                | Impact             | Notes                                    |
| --- | --------------------------------------------------- | ------------------ | ---------------------------------------- |
| R8  | Marketing overclaim (“live global wallet”)          | Brand destruction  | Growth freeze until GO                   |
| R9  | AI/insights perceived as financial advice           | Liability          | Keep non-advice; do not expand claims    |
| R10 | Admin Support demo mistaken for production tickets  | Ops chaos          | Keep labeled or remove from prod IA      |
| R11 | Accessibility / performance claims without evidence | Store / reputation | Do not claim AA or 95+ until measured    |
| R12 | Enterprise sold without SSO/SLA/audit               | Contract breach    | Separate from retail GA                  |
| R13 | Institutional onboarding without compliance program | Existential        | Do not pursue until dedicated workstream |

---

## Medium (manage in beta; fix before GA)

| ID  | Risk                              | Mitigation                                 |
| --- | --------------------------------- | ------------------------------------------ |
| R14 | Partial i18n / language selectors | Roadmap honesty; English-first until packs |
| R15 | Email/notification template gap   | Block GA notification campaigns            |
| R16 | Documentation sprawl at repo root | Index; archive over time                   |
| R17 | RTL not supported                 | Defer locales that require RTL             |

---

## Risks we reject as blockers _for closed beta_

| Claim                      | Board stance                             |
| -------------------------- | ---------------------------------------- |
| “UX isn’t perfect enough”  | Not blocking invite preview              |
| “Need more features”       | Explicitly rejected — sprawl harms trust |
| “Design system incomplete” | Aether is launch-grade for preview       |

---

## Residual risk after closed beta only

Invite preview still carries reputation risk if invites leak and press covers the product as GA. Mitigate with: watermark/preview language, no store listing, no paid growth, clear Known Limitations in beta communications.
