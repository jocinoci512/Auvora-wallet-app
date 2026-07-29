# 06 — Component Library

**System:** Aether Components  
**Status:** Spec only (Phase 1) — implementation lands after this source of truth  
**Rule:** One component per pattern. Experience-level CSS dialects are forbidden post-adoption.

---

## Foundations (shared)

| Token set      | Values                                                        |
| -------------- | ------------------------------------------------------------- |
| Space          | `0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64` (px)                 |
| Radius         | `none 0` · `sm 6` · `md 10` · `lg 14` · `xl 20` · `full 9999` |
| Control height | `sm 32` · `md 40` · `lg 48` · `xl 56` (touch primary = lg+)   |
| Focus          | 2px `lumen` ring + 2px canvas offset                          |
| Hit target     | min 44×44 px (mobile)                                         |

Composition primitives: `Stack`, `Row`, `Grid`, `Spacer`, `Divider`, `Bleed`, `Container` (mobile full-bleed; desktop max widths: content `720`, app `1120`, terminal `1440`).

---

## Actions

### Button

| Variant        | Use                                |
| -------------- | ---------------------------------- |
| `primary`      | One primary action per view region |
| `secondary`    | Alternate safe action              |
| `ghost`        | Tertiary / toolbar                 |
| `danger`       | Destructive confirm                |
| `danger-ghost` | Destructive in menus               |

Sizes: `sm` `md` `lg`.  
States: default · hover · pressed · focus-visible · disabled · loading (spinner replaces label, width locked).  
Icons: leading optional; icon-only requires `aria-label`.

### IconButton / Link / SegmentedControl

- IconButton: square, ghost by default
- Link: in-body navigation; never for irreversible money actions
- SegmentedControl: 2–4 options max (network, time range)

---

## Inputs

| Component                       | Notes                                                    |
| ------------------------------- | -------------------------------------------------------- |
| `TextField`                     | Label above; hint below; error replaces hint             |
| `AmountField`                   | Tabular nums; asset selector; fiat mirror caption        |
| `SearchField`                   | Leading search icon; clear button; debounce 150–200ms    |
| `TextArea`                      | Memos / notes; character count only if enforced          |
| `Select` / `Dropdown`           | Same trigger height as TextField; list in `e2` elevation |
| `Checkbox` / `Radio` / `Switch` | 44px hit area; label clickable                           |
| `Slider`                        | Rare — gas urgency only if product requires              |

Validation: inline, field-scoped. Never toast-only for form errors.

---

## Navigation

| Component         | Mobile                         | Desktop               |
| ----------------- | ------------------------------ | --------------------- |
| `TopBar`          | Title + account; optional back | Optional thin bar     |
| `BottomNav`       | 4–5 primary destinations       | Hidden                |
| `Sidebar`         | Hidden / drawer                | Persistent primary IA |
| `TabBar`          | Under-header section tabs      | Same                  |
| `AccountSwitcher` | Sheet                          | Popover               |
| `Breadcrumb`      | Rare                           | Settings / docs only  |

**Primary mobile destinations (target IA):** Home · Activity · Trade · NFTs · Settings  
Everything else lives inside those hubs.

---

## Wallet & portfolio

| Component       | Purpose                                                             |
| --------------- | ------------------------------------------------------------------- |
| `BalanceHero`   | Serif balance, caption, 3 verb actions                              |
| `WalletChip`    | Avatar/color + truncated name + network pip                         |
| `AssetRow`      | Icon, name, qty, fiat, sparkline optional                           |
| `PortfolioCard` | Only when interaction needs a container (e.g. selectable portfolio) |
| `AllocationBar` | Compact non-card distribution                                       |
| `NetworkPip`    | Color + tooltip/name                                                |

**No KPI grid of 6+ metric cards on Home.** Metrics fold into Activity or Portfolio detail.

---

## Trading

| Component      | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `SwapPanel`    | From/to legs, rate, fee, slip; single primary CTA |
| `QuoteSummary` | Expandable route details                          |
| `BridgePanel`  | Source/dest chain emphasis                        |
| `StakePanel`   | Validator + amount + rewards estimate             |
| `ConfirmSheet` | Universal money confirmation (see below)          |

---

## Activity & money movement

| Component       | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `TxItem`        | Direction pip, title, counterparty, amount, status, time    |
| `TxGroup`       | Day headers                                                 |
| `TxDetail`      | Full breakdown + explorer link                              |
| `ConfirmSheet`  | Amount hero + facts list + risk callout + primary/secondary |
| `ProgressSteps` | Sign → broadcast → confirm (3 steps max)                    |
| `FeeSelector`   | Low / Normal / Fast as segmented or list                    |

---

## NFTs

| Component          | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `NftCard`          | Media, collection, name; aspect stable; no hover chaos |
| `NftMediaViewer`   | Pinch/zoom desktop; respects reduced motion            |
| `CollectionHeader` | Cover restraint; floor optional for pros               |
| `NftEmpty`         | Quiet illustration + browse CTA                        |

Media failures → branded placeholder (never broken-image icon soup).

---

## Feedback

| Component          | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `Dialog`           | Centered, desktop; focus trap                        |
| `Sheet` / `Drawer` | Mobile preference for confirms                       |
| `Toast`            | Transient non-critical; 1 line + optional action     |
| `Banner`           | Persistent page-level notice                         |
| `Tooltip`          | Desktop labels; not for fees on mobile (use caption) |
| `Alert`            | Inline success/warn/error/info                       |
| `EmptyState`       | Title, body, primary action, optional secondary      |
| `Skeleton`         | Shape-matched to final content                       |
| `Spinner`          | Local only; full-page rare                           |
| `ErrorState`       | Recoverable action required                          |
| `SuccessState`     | Short celebration — check + sentence + done          |

---

## Data display

| Component                 | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `Table`                   | Desktop professional density; row hover; sticky header |
| `List`                    | Mobile substitute for many tables                      |
| `Chart` (line/area/donut) | Thin stroke; lagoon series; legend accessible          |
| `Badge` / `StatusBadge`   | Status only — not decoration                           |
| `Avatar`                  | Wallet / contact                                       |
| `Copyable`                | Mono string + copy button                              |

---

## Confirmations (universal pattern)

Every irreversible or value-moving action uses **`ConfirmSheet`**:

1. Title verb (“Send”, “Swap”, “Sign”)
2. Amount / subject in `balance-md` or title
3. Fact rows: asset, to/from, network, fee, time estimate
4. Optional risk `Alert`
5. Primary CTA with explicit verb (“Send 0.42 ETH”)
6. Secondary “Cancel”

No silent approvals. No “Confirm” without object.

---

## Do / Don’t

| Do                                   | Don’t                             |
| ------------------------------------ | --------------------------------- |
| Use `Button.primary` once per region | Stack three primary buttons       |
| Prefer `AssetRow` lists              | Wrap every asset in a heavy card  |
| Reuse `ConfirmSheet`                 | Invent per-flow modal layouts     |
| Skeleton-match layout                | Spinners over blank voids         |
| Token radii/spacing                  | `12px` one-offs in experience CSS |

---

## Inventory mapping (today → Aether)

| Today (fragmented)                                                  | Aether target                                   |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `dash-card`, `wx-panel`, `tx-panel`, `nx-panel`, `w3-panel`, `sc-*` | `Surface` + domain components                   |
| Multiple pill tab classes                                           | `TabBar`                                        |
| Duplicate security experiences                                      | One `SecurityCenter` flow                       |
| `@auvora/ui` Button/Input (keep API spirit)                         | Restyle to Aether tokens; expand missing pieces |

Full consolidation sequenced in `13_Improvement_Plan.md`.
