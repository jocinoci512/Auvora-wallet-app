# 05 — 24-Month Product Roadmap

## Principles

1. **Security and trust first** — features never outrun rails, legal, or ops.
2. **Customer feedback over speculation** — ship less, learn more in closed beta.
3. **Platform expansion after retail GO** — native, regions, enterprise are sequenced.
4. **Developer experience is leverage** — packages, CI, docs compound.

Horizon: **M0 = now (2026-07)** through **M24**.

---

## Year 1 (M0–M12)

### M0–M3 — Remediation & closed beta (mandatory)

| Priority              | Themes                                  | Outcomes                             |
| --------------------- | --------------------------------------- | ------------------------------------ |
| **P0 Security**       | Live rails, SSO, pen-test, secrets, CSP | Critical risks R1–R5 path closed     |
| **P0 Reliability**    | Restore drills, alerts, status host     | R6–R7 path closed                    |
| **P0 Privacy / CX**   | Published legal, real support contacts  | Public surfaces honest               |
| **Customer feedback** | Invite closed beta; structured feedback | Issue taxonomy; no phrase collection |
| **Performance**       | Staging soak baselines                  | Numbers for later CI gates           |
| **DX**                | E2E smoke for critical journeys         | Regressions caught early             |

**Launch posture:** Closed beta only. No public beta / GA / enterprise / institutional.

### M3–M6 — Evidence & controlled public beta (only if P0 done)

| Priority              | Themes                                        | Outcomes                      |
| --------------------- | --------------------------------------------- | ----------------------------- |
| **Security**          | Continuous scanning; bug bounty soft launch   | Residual risk managed         |
| **Performance**       | Lighthouse CI budgets; gateway HPA validation | Board can claim measured perf |
| **Accessibility**     | Automated WCAG + AA sample                    | Conditional → YES for claims  |
| **Customer feedback** | Public beta _if_ P0 closed; support SLAs soft | NPS / CSAT lightweight        |
| **Ops**               | On-call mature; runbook drills quarterly      | Incident muscle               |
| **Features**          | Polish existing money/Web3/security only      | No new speculative lines      |

**Gate:** Written executive **GO** for public beta. Else remain closed.

### M6–M12 — General availability preparation & retail GO

| Priority              | Themes                                                      | Outcomes               |
| --------------------- | ----------------------------------------------------------- | ---------------------- |
| **Security**          | Annual pen-test; SOC2 Type I kickoff (optional)             | Enterprise path starts |
| **Performance**       | Prod load evidence; CDN/cache tuning                        | Scale toward millions  |
| **Customer feedback** | In-product feedback; help CMS                               | Support portal real    |
| **Features**          | Prioritized from beta data (fees UX, recovery, dApp safety) | Evidence-based backlog |
| **Platform**          | App Store / Play **only after GA GO**                       | Native wrappers begin  |
| **i18n**              | First language packs beyond English                         | Global Stage D         |
| **DX**                | Component library docs; internal tooling                    | Faster safe shipping   |

**Gate:** Full GA GO per checklist. Growth campaigns unlock after this gate — not before.

---

## Year 2 (M12–M24)

### M12–M18 — Scale & trust depth

| Priority               | Themes                                               | Outcomes                        |
| ---------------------- | ---------------------------------------------------- | ------------------------------- |
| **Security**           | Bug bounty public; continuous compliance             | Institutional interest credible |
| **Performance**        | Multi-region read paths; chaos drills                | Millions-user posture           |
| **Customer feedback**  | Regional support hours; education content            | Anxiety down globally           |
| **Features**           | Selective expansion (hardware depth, permissions UX) | Still no advice theater         |
| **Platform expansion** | Second region; RTL for priority locales              | True global readiness           |
| **Enterprise**         | SSO for partners, audit exports, SLAs                | First enterprise pilots         |
| **DX**                 | Public developer docs maturity; API stability        | External builders               |

### M18–M24 — Platform & institutional track (separate GO)

| Priority                  | Themes                                                  | Outcomes                     |
| ------------------------- | ------------------------------------------------------- | ---------------------------- |
| **Security / Compliance** | SOC2 Type II / equivalent as required                   | Institutional gate           |
| **Institutional**         | Dedicated custody/compliance workstream                 | Own board GO — not retail GO |
| **Performance**           | Capacity planning for peak events                       | Stress-tested                |
| **Features**              | Portfolio/insights maturity under privacy constraints   | Measured value               |
| **Platform**              | Additional chains/providers with fail-closed validation | Expansion without sprawl     |
| **DX**                    | SDK versioning & deprecation policy                     | Long-term maintainability    |

---

## Priority stack (always)

When capacity conflicts, rank:

1. **Security**
2. **Reliability / performance (user-felt)**
3. **Customer feedback → fix loops**
4. **Developer experience** (to sustain 1–3)
5. **New features** (only from evidence)
6. **Platform expansion** (regions, native, enterprise, institutional)

---

## What we will not roadmap as “must ship”

- Guaranteed-return products
- Unlabeled AI financial advice
- Feature volume to impress press
- Enterprise logos before SSO/SLA

---

## Success metrics (illustrative)

| Horizon | Metric                                                         |
| ------- | -------------------------------------------------------------- |
| M3      | P0 remediated; closed beta NPS qualitative                     |
| M6      | Public beta crash-free sessions; support TTR                   |
| M12     | GA checklist green; store presence if GO                       |
| M24     | Multi-region; enterprise pilots; institutional program defined |

Honesty metric forever: **zero** incidents of “success” UI without live settlement.
