# 13 — Improvement Plan

**Purpose:** Turn Phase 1 vision + audits into an executable sequence  
**Constraint:** No page redesign until Aether foundations are approved and Phase 2 tokens land

---

## Guiding rule

> Fix the **system** before restyling the **screens**.

Restyling Home while five CSS dialects and a 28-link nav remain will recreate today’s debt in new colors.

---

## Workstreams

```
A  Foundations (tokens, type, primitives, motion)
B  Information architecture & shell
C  Core flows (Home, Send, Receive, Swap, Confirm)
D  Trust (Security, backup, sessions, sign)
E  Wealth surfaces (Portfolio, Activity, NFTs)
F  Quality (a11y, performance, cleanup)
```

---

## Wave 0 — Approval gate (immediate)

| Action                                             | Owner              | Output                 |
| -------------------------------------------------- | ------------------ | ---------------------- |
| Review `01`–`10` as product/design source of truth | Design + Eng leads | Written approval       |
| Freeze new experience CSS dialects                 | Eng                | Lint/contributing rule |
| Agree consumer nav exclusions (ops/lab)            | Product            | Route policy           |

**Exit:** Aether adopted; no new `*-experience.css` patterns.

---

## Wave 1 — Foundations (Phase 2)

| #   | Item                                                                     | Audit refs  | Effort |
| --- | ------------------------------------------------------------------------ | ----------- | ------ |
| 1.1 | Implement Mist/Lagoon semantic tokens; alias old teal-paper              | UI 1, 2     | M      |
| 1.2 | Load Syne, Manrope, Source Serif 4; keep Plex Mono                       | UI 3        | S      |
| 1.3 | Encode space/radius/shadow/focus tokens in code                          | UI 2        | S      |
| 1.4 | Restyle Button, Input, Field, Alert, Toast, Tabs, Dialog/Sheet, Skeleton | UI 2, 5     | M      |
| 1.5 | Centralize motion tokens; delete duplicate keyframes                     | UI 6        | S      |
| 1.6 | High-contrast + reduced-motion verification on primitives                | UI 7 · A11y | S      |

**Exit:** Design-system gallery shows Aether only; primitives pass keyboard + contrast checks.

---

## Wave 2 — Shell & IA (Phase 3)

| #   | Item                                                     | Audit refs | Effort |
| --- | -------------------------------------------------------- | ---------- | ------ |
| 2.1 | Define canonical route map (consumer vs admin vs lab)    | UX 1       | M      |
| 2.2 | Mobile BottomNav (Home, Activity, Trade, NFTs, Settings) | UX 1, 7    | M      |
| 2.3 | Desktop Sidebar with mental-model groups                 | UX 1       | M      |
| 2.4 | Remove ops/lab from consumer `Nav.tsx`                   | UX 1 P0    | S      |
| 2.5 | AccountSwitcher + TopBar templates                       | UX 2       | S      |
| 2.6 | Redirect policy for deprecated duplicate paths           | UX 1 pairs | S      |

**Exit:** Users can navigate core jobs in ≤3 taps; mega-menu gone.

---

## Wave 3 — Core money UX (Phase 4)

| #   | Item                                        | Audit refs      | Effort |
| --- | ------------------------------------------- | --------------- | ------ |
| 3.1 | Home → BalanceHero (no KPI card wall)       | UX 2 P0 · UI 4  | M      |
| 3.2 | Universal ConfirmSheet + ProgressSteps      | UX 3 · Comp lib | M      |
| 3.3 | Send flow on Aether templates               | UX 3            | M      |
| 3.4 | Receive flow (QR + warnings)                | UX 3            | S      |
| 3.5 | Swap panel Aether pass                      | UX 3            | M      |
| 3.6 | Replace deceptive demo-first charts on Home | UX 2 · UI 8     | S      |

**Exit:** Formative test: new user completes receive + send comprehension without coaching.

---

## Wave 4 — Trust & identity (Phase 6 parallelizable)

| #   | Item                                                      | Audit refs | Effort |
| --- | --------------------------------------------------------- | ---------- | ------ |
| 4.1 | Merge `/security` into Settings Security Center; redirect | UX 5 P0    | M      |
| 4.2 | Backup / recovery copy + Confirm patterns                 | UX 4       | M      |
| 4.3 | Connected dapps + sessions one list                       | UX 5, 6    | M      |
| 4.4 | Sign request humanization template                        | UX 6 P0    | M      |

**Exit:** One answer to “Am I safe?”; sign flow AA-usable.

---

## Wave 5 — Unify wealth surfaces (Phase 5)

| #   | Item                                                  | Audit refs | Effort |
| --- | ----------------------------------------------------- | ---------- | ------ |
| 5.1 | Single Activity inbox + filters                       | UX 1, 6    | M      |
| 5.2 | Portfolio list using AssetRow (not card grid default) | UI 4       | M      |
| 5.3 | NFT gallery Aether (media, empty, detail)             | UX 6       | M      |
| 5.4 | Resolve `/nfts` vs `/digital-assets` naming           | UX 1       | S      |

**Exit:** No duplicate “activity” or NFT homes in IA.

---

## Wave 6 — Hardening (Phase 7–8)

| #   | Item                                             | Audit refs | Effort |
| --- | ------------------------------------------------ | ---------- | ------ |
| 6.1 | Desktop density mode + shortcuts                 | UX 7       | L      |
| 6.2 | Delete obsolete experience CSS / dead components | UI 2       | M      |
| 6.3 | A11y evidence pack (Send/Swap/Sign)              | `09`       | M      |
| 6.4 | Performance budget: Home JS/CSS weight           | UI 8       | M      |
| 6.5 | Admin Aether chrome (ops density OK)             | UI 5       | M      |

---

## Bugfix parallel track (can start anytime)

| Issue                                  | Sev | Action                      |
| -------------------------------------- | --- | --------------------------- |
| Duplicate `main` landmark on dashboard | P1  | Remove nested `role="main"` |
| themeColor vs canvas mismatch          | P2  | Align metadata to tokens    |
| Nav hit area padding                   | P1  | Increase to ≥44px targets   |
| Tabs-as-links keyboard model           | P1  | Use real Tabs or fix ARIA   |
| font-weight 650/560                    | P1  | Map to 600/500              |

These do not require full Aether — fix safely without feature work.

---

## Success metrics

| Metric                              | Baseline (now) | Target post Wave 3                      |
| ----------------------------------- | -------------- | --------------------------------------- |
| Primary nav destinations (consumer) | ~28            | ≤5 mobile · ≤8 sidebar top-level groups |
| Experience CSS dialects             | 6              | ≤1 shared + tokens                      |
| Home cards above fold               | 12+            | ≤1 hero surface + list                  |
| Security entry points               | 2              | 1                                       |
| Activity entry points               | 3+             | 1                                       |
| UI consistency score                | 4/10           | ≥8/10                                   |
| UX clarity score                    | 4/10           | ≥8/10                                   |

---

## Risk register

| Risk                              | Mitigation                                       |
| --------------------------------- | ------------------------------------------------ |
| Big-bang rewrite stalls shipping  | Wave by foundation → shell → flows               |
| Design drift mid-implementation   | Aether docs canonical; gallery snapshots         |
| Feature FOMO reopens mega-nav     | Route policy + product review gate               |
| Token migration breaks admin/docs | Shared `@auvora/ui` versioning; visual QA matrix |

---

## Immediate next step after Phase 1 approval

**Start Wave 1.1–1.4** in `@auvora/ui` only.  
Do not redesign `DashboardExperience` until BottomNav/Sidebar IA is decided (Wave 2) — otherwise Home will be redesigned twice.

---

## Document index

| Doc                       | Role              |
| ------------------------- | ----------------- |
| `01_Product_Vision.md`    | Why               |
| `02_Design_Principles.md` | Decision filter   |
| `03_Brand_Guidelines.md`  | Identity          |
| `04_Color_System.md`      | Color tokens      |
| `05_Typography_System.md` | Type tokens       |
| `06_Component_Library.md` | UI inventory      |
| `07_Motion_System.md`     | Motion tokens     |
| `08_UX_Principles.md`     | Interaction rules |
| `09_Accessibility.md`     | A11y bar          |
| `10_Product_Roadmap.md`   | Phases            |
| `11_UI_Audit.md`          | Visual debt       |
| `12_UX_Audit.md`          | Experience debt   |
| `13_Improvement_Plan.md`  | This plan         |
