# 11 — UI Audit

**Scope:** Current `apps/web` (primary), shared `@auvora/ui`, brief `apps/admin`  
**Mode:** Observation only — no redesign in this phase  
**Date reference:** Phase 1 design-system pass

---

## Executive summary

The codebase already has a **credible token foundation** in `@auvora/ui` (teal-on-warm-paper, IBM Plex, light/dark). What prevents a world-class UI is not a lack of screens — it is **fragmentation**: five parallel “experience” CSS dialects, card-heavy home composition, mega-navigation, and weak brand presence in the first viewport.

Aether (docs `03`–`07`) defines the target. This audit inventories the gap.

---

## Severity legend

| Sev | Meaning                                                    |
| --- | ---------------------------------------------------------- |
| P0  | Blocks premium perception or causes systemic inconsistency |
| P1  | High friction / visible quality debt                       |
| P2  | Polish / local inconsistency                               |

---

## 1. Branding & visual language

| Finding                                                                 | Sev | Evidence                                                                                                   |
| ----------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------- |
| Brand test fails on Home                                                | P0  | First viewport is generic “Dashboard” + KPI cards; wordmark only in nav (`DashboardExperience`, `Nav.tsx`) |
| Warm-paper teal is coherent but not distinctive enough vs premium peers | P1  | `packages/ui` tokens `#0f6e56` / `#f7f4ef` — calm fintech, easy to confuse with other green-ledger UIs     |
| Atmosphere gradient is subtle, not signature                            | P2  | `.auvora-app-shell` radial wash in UI styles                                                               |
| Theme color mismatch                                                    | P2  | Layout `themeColor` `#f7f6f3` vs token background `#f7f4ef`                                                |
| Error color drift                                                       | P2  | Globals fallback `#d92d20` vs token `#b42318`                                                              |
| Legacy aliases still in play                                            | P2  | `--auvora-ink`, `--auvora-accent` alongside newer semantic names                                           |

---

## 2. Design system fragmentation

| Finding                                                 | Sev | Evidence                                                                                  |
| ------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------- |
| Parallel panel systems                                  | P0  | `dash-`, `wx-`, `tx-`, `nx-`, `w3-`, `sc-` CSS prefixes across experience stylesheets     |
| ~93KB CSS before minify across foundation + experiences | P1  | `styles.css` + `dashboard.css` + five `*-experience.css` + `globals.css`                  |
| Duplicate fade keyframes                                | P1  | `auvora-fade-up`, `wx-fade`, `tx-fade`, `sc-fade`, nx/w3 variants                         |
| Radius drift                                            | P1  | Tokens `6/10/14`; experiences often hard-code `8px` / `12px`                              |
| Spacing off-scale                                       | P1  | `--dash-gap` / `--wx-gap` ≈ `0.85rem` not on 4/8 rhythm; inline `marginTop: 0.45rem` etc. |
| `@auvora/ui` primitives underused for chrome            | P1  | Button/Input/Dialog used; layout chrome reinvented per domain                             |
| Experience components proliferate (~38 `*Experience`)   | P1  | `components/{dashboard,wallet,trading,nft,web3,settings,portfolio}/`                      |

---

## 3. Typography inconsistencies

| Finding                        | Sev | Evidence                                                                                                |
| ------------------------------ | --- | ------------------------------------------------------------------------------------------------------- |
| Competing H1 scales            | P1  | Token h1 `2rem` / display `2.75rem`; experience headers `~1.65–2.2rem`; dashboard hello `~1.35–1.75rem` |
| Non-loaded font weights        | P1  | Dashboard `font-weight: 650` / `560` — not in `next/font` weight list                                   |
| Type utility classes ignored   | P2  | `.auvora-type-*` exists; experiences style raw `h1` locally                                             |
| Single family only (Plex Sans) | P1  | No display/serif distinction for balances — weak money hierarchy                                        |

---

## 4. Layout & composition

| Finding                     | Sev | Evidence                                              |
| --------------------------- | --- | ----------------------------------------------------- |
| Card overuse on Home        | P0  | Dense KPI / `dash-card` grid in first scroll          |
| Divergent max-widths        | P1  | `960` / `1120` / `1280` / `880` / `920` across shells |
| Header-only AppShell on web | P1  | No consumer sidebar; no mobile bottom nav             |
| Cards as default decoration | P1  | Panels with borders/shadows where lists would suffice |

---

## 5. Components & duplication

| Finding                                              | Sev | Evidence                                                                         |
| ---------------------------------------------------- | --- | -------------------------------------------------------------------------------- |
| Security UI split                                    | P0  | `wallet/SecurityExperience` (`/security`) vs `settings/SecurityCenterExperience` |
| Section nav reinvented                               | P1  | `SettingsSectionNav`, `Web3SectionNav`, Subnav pill patterns                     |
| Wizard patterns diverge                              | P1  | `WizardShell` vs ad-hoc trading multi-step                                       |
| Choice grids / token boxes / KPI cards reimplemented | P1  | Per CSS file rather than shared primitives                                       |
| Admin shares tokens but flat 16-link nav             | P2  | `apps/admin` `Nav.tsx`                                                           |

---

## 6. Motion

| Finding                         | Sev | Evidence                                             |
| ------------------------------- | --- | ---------------------------------------------------- |
| No unified motion tokens        | P1  | Per-shell entrance fades ~260–280ms only             |
| Good reduced-motion hooks exist | —   | UI + experience CSS respect `prefers-reduced-motion` |
| CountUp + chart draw present    | P2  | Useful but not branded as a system                   |

---

## 7. Accessibility (UI-layer)

| Finding                          | Sev | Evidence                                                       |
| -------------------------------- | --- | -------------------------------------------------------------- |
| Possible duplicate `main`        | P1  | Dashboard `role="main"` inside layout `#main-content`          |
| Tabs-as-links                    | P1  | Pill `Link` tabs without full tablist keyboard model in places |
| Muted opacity on glass           | P1  | ~65–68% muted text risk on translucent surfaces                |
| Dense nav targets                | P1  | Horizontal padding `0.15rem` on nav links                      |
| High-contrast flag unclear in UI | P2  | `data-high-contrast` vs Preferences wiring                     |

**Positives:** skip link, `:focus-visible`, `aria-current`, touch target utilities, chart labels, many radiogroup patterns in wizards.

---

## 8. Performance (UI)

| Finding                                        | Sev | Evidence                                                |
| ---------------------------------------------- | --- | ------------------------------------------------------- |
| Home fully client + charts + CountUp           | P1  | `DashboardExperience`                                   |
| Demo data defaults widely                      | P1  | `lib/**/demo*`, trading demos — can look “fake premium” |
| Large CSS pulled via client experience imports | P1  | Experience CSS coupled to client components             |
| Access token panel always in layout            | P2  | Root layout                                             |

---

## 9. Static assets & metadata

| Finding                             | Sev | Evidence                                       |
| ----------------------------------- | --- | ---------------------------------------------- |
| NFT placeholder exists              | —   | `public/nft-placeholder.svg`                   |
| Fonts via next/font (good)          | —   | IBM Plex Sans/Mono in `layout.tsx`             |
| Metadata fine; brand weak in chrome | P1  | Title uses env app name; visual brand not hero |

---

## 10. What is already strong (preserve spirit)

1. Semantic token attempt in `@auvora/ui` + JS mirror `tokens.ts`
2. Light/dark theme infrastructure
3. Security headers / CSP report-only posture in Next config (engineering trust)
4. Reduced-motion awareness in multiple CSS files
5. Intent to separate domains (wallet / trading / nft) — structure exists; presentation dialects must merge

---

## UI debt scorecard

| Category                                   | Score (0–10) | Notes                                               |
| ------------------------------------------ | ------------ | --------------------------------------------------- |
| Token coherence                            | 7            | Good base; warm-paper identity to retire for Aether |
| Component consistency                      | 3            | Severe parallel systems                             |
| Typography                                 | 5            | Readable; weak hierarchy / identity                 |
| Layout craft                               | 4            | Card clutter; width chaos                           |
| Brand presence                             | 3            | Nav wordmark only                                   |
| Motion system                              | 4            | Micro only; duplicated                              |
| Accessibility UI                           | 6            | Foundations present; gaps real                      |
| **Overall UI readiness for “world class”** | **4 / 10**   | Docs Phase 1 required before redesign               |

---

## Implications for Aether

- Replace warm teal-paper with **Mist + Lagoon** (`04`)
- Replace Plex-only UI with **Syne / Manrope / Source Serif 4** (`05`)
- Collapse experience CSS into **one component library** (`06`)
- Introduce motion tokens (`07`)

Do not restyle page-by-page before Phase 2 foundations.
