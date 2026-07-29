# 10 — Product Roadmap

**Scope:** Design system adoption & product UX elevation  
**Constraint:** Phase 1 = documentation only (this folder). No page redesign until Aether is approved as source of truth.

---

## Phase map

```
Phase 1  Vision & Aether docs + audits          ← YOU ARE HERE
Phase 2  Token & primitive implementation
Phase 3  Shell & navigation redesign
Phase 4  Core money flows (Home, Send, Receive, Swap)
Phase 5  Activity, Portfolio, NFTs, Web3 sign
Phase 6  Settings / Security unification
Phase 7  Desktop terminal density + shortcuts
Phase 8  Polish, a11y certification, motion QA
```

---

## Phase 1 — Vision & Design System (current)

**Deliverables:** `01`–`13` in this folder  
**Exit criteria:**

- [x] Product vision & principles documented
- [x] Aether brand, color, type, components, motion specified
- [x] UX + a11y principles documented
- [x] UI/UX audits against current `apps/web`
- [x] Sequenced improvement plan
- [ ] Stakeholder approval of Aether as single source of truth

**No production UI redesign in this phase.**

---

## Phase 2 — Foundations in code

- Implement Aether tokens in `@auvora/ui` (color, space, radius, type, shadow, motion)
- Load Syne / Manrope / Source Serif 4 / Plex Mono
- Restyle primitives: Button, Input, Dialog/Sheet, Tabs, Alert, Toast, Skeleton
- Deprecate parallel experience CSS variables that conflict
- Theme: light / dark / high-contrast hooks

**Exit:** Storybook or design-system gallery renders Aether primitives; old teal-paper tokens aliased then removed.

---

## Phase 3 — Shell & IA

- Mobile `BottomNav` (≤5 items)
- Desktop `Sidebar` grouped by mental model
- Remove consumer mega-menu / ops routes from web primary nav
- Unify account switcher + top bar
- Establish page templates: `BalanceHero`, `ListPage`, `FormWizard`, `ConfirmSheet`

**Exit:** New users can explain IA in one sentence; route map published.

---

## Phase 4 — Core money flows

Priority order:

1. Home (balance stage)
2. Send
3. Receive
4. Swap
5. Buy/Sell (if in scope)

Apply ConfirmSheet + ProgressSteps everywhere value moves.

**Exit:** Task success rates up in formative tests; no demo-chart deception on Home.

---

## Phase 5 — Wealth surfaces

- Portfolio & asset detail
- Activity unified (one inbox; filters for tx / web3 / nft)
- NFT gallery & detail
- Web3 connect / sign / permissions

**Exit:** Duplicate “activity” concepts collapsed; NFT media a11y complete.

---

## Phase 6 — Trust center

- Merge `/security` and settings security into one Security Center
- Backup / recovery UX rewrite under Aether
- Sessions, devices, connected dapps
- Privacy & notification preferences

**Exit:** One path for “am I safe?”

---

## Phase 7 — Professional desktop

- Dense tables, keyboard shortcuts, multi-panel optional
- Address book power features
- Export / audit-friendly details

**Exit:** Professionals complete common tasks without hunting.

---

## Phase 8 — Hardening

- WCAG AA evidence pack
- Motion audit under reduced-motion
- Performance budgets (CSS weight, TTI on Home)
- Remove dead experience CSS dialects
- Admin adopts Aether chrome (ops density allowed)

---

## Priority scoring (for Phase 2+ scheduling)

| Theme                  | User impact | Trust impact | Effort | Order |
| ---------------------- | ----------- | ------------ | ------ | ----- |
| Tokens + type          | High        | High         | M      | 1     |
| Nav IA                 | High        | High         | M      | 2     |
| Home rewrite           | High        | High         | M      | 3     |
| Send/Receive/Swap      | High        | Critical     | L      | 4     |
| ConfirmSheet universal | High        | Critical     | M      | 5     |
| Security unification   | Med         | Critical     | M      | 6     |
| Activity merge         | Med         | Med          | M      | 7     |
| NFT Aether pass        | Med         | Low          | M      | 8     |
| Desktop density        | Med         | Med          | L      | 9     |

---

## Explicit non-roadmap (near term)

- Cloning Phantom/Exodus visuals
- Adding features solely to fill nav
- Per-page one-off “premium” CSS
- Dark-only brand relaunch

---

## Governance

- Aether docs in `docs/design-system/` are canonical
- UI PRs reference tokens/components; exceptions need design review
- Audits (`11`, `12`) updated when major surfaces change
