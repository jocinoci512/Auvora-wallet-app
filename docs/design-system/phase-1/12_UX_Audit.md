# 12 — UX Audit

**Scope:** Information architecture, flows, cognitive load, user altitudes  
**Primary surface:** `apps/web`  
**Mode:** Observation only

---

## Executive summary

Functionally, Auvora Web already exposes a **broad wallet + trading + NFT + web3 + settings** surface (~70 routes). UX quality is limited by **information architecture sprawl**, **home-as-dashboard overload**, **duplicated jobs**, and **altitude blindness** (beginner and professional share the same mega-menu noise).

---

## Severity legend

| Sev | Meaning                                           |
| --- | ------------------------------------------------- |
| P0  | Causes wrong mental model or high error/risk risk |
| P1  | Significant friction or confusion                 |
| P2  | Minor / edge                                      |

---

## 1. Information architecture

| Finding                         | Sev | Detail                                                                                                                                                                 |
| ------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mega-navigation                 | P0  | `Nav.tsx`: ~10 primary + ~18 “More” ≈ **28 destinations**; desktop shows both rows                                                                                     |
| Consumer + platform + lab mixed | P0  | Buy/Swap beside Compliance, Custody, Analytics, AI, Connect lab, Design System                                                                                         |
| Route sprawl                    | P1  | ~70 `page.tsx` files — many valid features, weak grouping                                                                                                              |
| Confusing pairs                 | P0  | `/security` vs `/settings`; `/nfts` vs `/digital-assets`; `/activity` vs `/web3/activity` vs `/blockchain/transactions`; `/notifications` vs `/settings/notifications` |
| No mobile bottom nav            | P1  | Collapse to “More” is a list of leftovers, not a native grammar                                                                                                        |
| Brand not a home CTA            | P2  | “Auvora” text in nav; Dashboard is a peer link                                                                                                                         |

**User impact:** Intermediate users hunt. Beginners freeze. Professionals distrust the product’s seriousness.

---

## 2. Home / first session

| Finding                                     | Sev | Detail                                                    |
| ------------------------------------------- | --- | --------------------------------------------------------- |
| Home is a KPI dashboard, not a wallet stage | P0  | Multiple cards, chart, quick actions — violates “one job” |
| Generic title “Dashboard”                   | P1  | Does not say “your money”                                 |
| Demo-driven portfolio                       | P1  | Demo libs can teach false confidence or look unfinished   |
| Quick actions compete with primary verbs    | P1  | Icon grid dilutes Send / Receive / Swap                   |

---

## 3. Money flows

| Finding                                                             | Sev | Detail                                              |
| ------------------------------------------------------------------- | --- | --------------------------------------------------- |
| Experience shells share a good skeleton                             | —   | Eyebrow + title + tabs + panels — trainable pattern |
| Confirmation patterns not universal                                 | P1  | Trading vs wallet wizards differ                    |
| Fee / risk literacy varies by flow                                  | P1  | Needs one ConfirmSheet standard                     |
| Bridge / stake / buy / sell / swap each feel like separate products | P2  | Visual dialects reinforce silo feeling              |

---

## 4. Onboarding & custody

| Finding                                | Sev | Detail                                                                                                                          |
| -------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------- |
| Multiple entry routes                  | P1  | create / import / restore / hardware / watch / onboarding / recovery — powerful but easy to overwhelm without a single door hub |
| WizardShell helps wallet flows         | —   | Good base for Aether FormWizard                                                                                                 |
| Watch-only vs full custody distinction | P1  | Must stay extremely clear to avoid send attempts on watch wallets                                                               |

---

## 5. Security & settings

| Finding                                        | Sev | Detail                                 |
| ---------------------------------------------- | --- | -------------------------------------- |
| Two security centers                           | P0  | Split trust story                      |
| Settings section nav is clear locally          | —   | Good hub pattern to extend             |
| Preferences / privacy / devices / backup exist | —   | Coverage is strong; findability is not |
| High-contrast / a11y prefs unclear             | P2  | Token exists; UX path uncertain        |

---

## 6. Web3 & NFTs

| Finding                                   | Sev | Detail                                                                  |
| ----------------------------------------- | --- | ----------------------------------------------------------------------- |
| Web3 hub + browser + sign + permissions   | —   | Solid feature map                                                       |
| Activity concepts overlap wallet activity | P1  | Users won’t know which “activity” is canonical                          |
| NFT gallery vs digital assets hub         | P1  | Naming overlap                                                          |
| Signing UX critical path                  | P0  | Must prioritize human-readable intent (audit flags for future redesign) |

---

## 7. Altitude fit

| Altitude     | Current fit | Gap                                                                              |
| ------------ | ----------- | -------------------------------------------------------------------------------- |
| Beginner     | Poor        | Jargon-adjacent nav; no strong guided home; demo ambiguity                       |
| Intermediate | Med         | Speed hurt by hunting; flows mostly complete once found                          |
| Professional | Med-Low     | Density exists in places but IA screams “kit”; ops links pollute consumer chrome |

No density toggle or “advanced” progressive disclosure system at product level.

---

## 8. Feedback states

| Finding                                         | Sev | Detail                                |
| ----------------------------------------------- | --- | ------------------------------------- |
| Empty/feedback components exist in `@auvora/ui` | —   | Under-standardized across experiences |
| Loading often spinner/skeleton mix              | P2  | Skeleton mismatch risk                |
| Error recovery inconsistent                     | P1  | Per-experience                        |

---

## 9. Navigation & wayfinding issues (scenarios)

1. **“I want to see if I’m safe”** → `/security` or Settings Security?
2. **“What did I just do?”** → Activity vs Web3 activity vs NFT activity
3. **“Send money”** → findable, but after dashboard noise
4. **“Connect a dapp”** → Web3 vs Settings dapps
5. **“Ops metric”** → should not appear in consumer wallet at all

---

## 10. UX scorecard

| Category                           | Score (0–10) |
| ---------------------------------- | ------------ |
| Clarity of primary job             | 3            |
| IA / findability                   | 3            |
| Flow completeness (features exist) | 8            |
| Beginner approachability           | 3            |
| Intermediate speed                 | 5            |
| Professional efficiency            | 4            |
| Trust & confirmation quality       | 5            |
| Consistency across domains         | 3            |
| **Overall UX quality**             | **4 / 10**   |

---

## Opportunities (what good looks like)

1. **Balance-first Home** with three verbs
2. **Five-destination mobile IA** + desktop sidebar groups
3. **One Activity inbox** with filters
4. **One Security Center**
5. **Universal ConfirmSheet** for value + signatures
6. **Altitude controls** (guided vs compact) without splitting the app

Sequencing lives in `13_Improvement_Plan.md` and `10_Product_Roadmap.md`.
