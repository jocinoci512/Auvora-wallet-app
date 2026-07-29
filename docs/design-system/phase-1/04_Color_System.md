# 04 — Color System

**System:** Aether Color  
**Modes:** Light (default) · Dark (parity) · High contrast (AA+ boost)  
**Rule:** No raw hex in product UI after adoption — only semantic tokens.

---

## Design intent

Aether color is **cool, mineral, and quiet**.

It deliberately avoids:

- Purple / indigo “AI crypto” gradients
- Warm cream + terracotta editorial clichés
- Neon glow accents
- Pure `#000` / harsh `#FFF` as primary canvas (except high-contrast mode)

---

## Core palette (reference)

### Light

| Token name       | Hex       | Role                                  |
| ---------------- | --------- | ------------------------------------- |
| `canvas`         | `#EEF1F4` | App background (Mist)                 |
| `canvas-subtle`  | `#E4E8ED` | Recessed zones, table zebra soft      |
| `surface`        | `#F7F9FB` | Raised panels (solid preferred)       |
| `surface-solid`  | `#FFFFFF` | Modals, inputs on canvas              |
| `ink`            | `#0B1220` | Primary text                          |
| `ink-muted`      | `#5C6570` | Secondary text (≥4.5:1 on canvas)     |
| `ink-faint`      | `#8B939E` | Tertiary / timestamps (use carefully) |
| `line`           | `#D5DBE3` | Borders, dividers                     |
| `line-strong`    | `#B8C0CC` | Emphasized separators                 |
| `lagoon`         | `#0E4F5C` | Primary interactive / brand signal    |
| `lagoon-hover`   | `#0A3F49` | Hover                                 |
| `lagoon-pressed` | `#08333B` | Pressed                               |
| `lagoon-muted`   | `#D5E8EC` | Soft selected backgrounds             |
| `lumen`          | `#5EEAD4` | Focus ring / live pulse only          |
| `reserve`        | `#9A7B4F` | Verified / premium (rare)             |
| `success`        | `#0F6A4B` | Positive / confirmed                  |
| `success-soft`   | `#E6F5EF` | Success surfaces                      |
| `warning`        | `#8A5A00` | Caution                               |
| `warning-soft`   | `#FFF6E5` | Warning surfaces                      |
| `danger`         | `#B42318` | Destructive / errors                  |
| `danger-soft`    | `#FDEEEC` | Danger surfaces                       |
| `info`           | `#185FA5` | Neutral informational                 |
| `info-soft`      | `#E8F2FC` | Info surfaces                         |

### Dark

| Token name       | Hex       | Role                |
| ---------------- | --------- | ------------------- |
| `canvas`         | `#0A0C10` | App background      |
| `canvas-subtle`  | `#12151C` | Recessed            |
| `surface`        | `#151922` | Raised              |
| `surface-solid`  | `#1B202B` | Modals / inputs     |
| `ink`            | `#E8EAED` | Primary text        |
| `ink-muted`      | `#9AA3AD` | Secondary           |
| `ink-faint`      | `#6B7380` | Tertiary            |
| `line`           | `#2A3140` | Borders             |
| `line-strong`    | `#3A4354` | Strong borders      |
| `lagoon`         | `#3D9AAA` | Primary interactive |
| `lagoon-hover`   | `#54AAB8` | Hover               |
| `lagoon-pressed` | `#2F7F8C` | Pressed             |
| `lagoon-muted`   | `#143039` | Soft selected       |
| `lumen`          | `#5EEAD4` | Focus / live        |
| `reserve`        | `#C4A574` | Verified / premium  |
| `success`        | `#3DBF8F` | Positive            |
| `success-soft`   | `#0F2A22` | Success surfaces    |
| `warning`        | `#E0B15A` | Caution             |
| `warning-soft`   | `#2A2110` | Warning surfaces    |
| `danger`         | `#F97066` | Destructive         |
| `danger-soft`    | `#2A1210` | Danger surfaces     |
| `info`           | `#7EB6E8` | Informational       |
| `info-soft`      | `#10202A` | Info surfaces       |

---

## Semantic aliases (product API)

Map components to **meaning**, not paint:

| Semantic           | Light maps to                        | Usage                    |
| ------------------ | ------------------------------------ | ------------------------ |
| `bg.app`           | `canvas`                             | Root                     |
| `bg.subtle`        | `canvas-subtle`                      | Sections                 |
| `bg.elevated`      | `surface` / `surface-solid`          | Panels, sheets           |
| `fg.default`       | `ink`                                | Body                     |
| `fg.muted`         | `ink-muted`                          | Descriptions             |
| `fg.faint`         | `ink-faint`                          | Meta                     |
| `border.default`   | `line`                               | Default hairlines        |
| `border.strong`    | `line-strong`                        | Inputs at rest optional  |
| `action.primary`   | `lagoon`                             | Primary buttons, links   |
| `action.primaryFg` | `#FFFFFF` (light) / `#0A0C10` (dark) | On primary               |
| `focus.ring`       | `lumen` + ink offset                 | `:focus-visible`         |
| `status.success`   | `success`                            | Confirmed tx             |
| `status.warning`   | `warning`                            | Risk / pending attention |
| `status.danger`    | `danger`                             | Errors / destructive     |
| `status.info`      | `info`                               | Neutral notices          |
| `brand.reserve`    | `reserve`                            | Verified badge only      |

---

## Gradients

Aether gradients are **atmosphere, not identity**.

| Name               | Spec                                    | Allowed use              |
| ------------------ | --------------------------------------- | ------------------------ |
| `atmosphere-light` | radial lagoon at 4–6% opacity on canvas | App shell wash only      |
| `atmosphere-dark`  | radial lumen at 3–5% opacity on canvas  | App shell wash only      |
| `chart-area`       | lagoon 12% → 0%                         | Sparklines / area charts |

**Forbidden:** purple mesh, multi-stop hero rainbows, text-fill gradients on body copy, glow shadows as brand.

---

## Glass

Glass is **minimal** and reserved for:

- Sticky mobile top bar
- Desktop sidebar overlay on scroll (optional)
- Toast / tooltip scrims

Spec (light): `bg: rgba(247,249,251,0.82)` + `backdrop-filter: blur(16px)` + `border: line`.  
If blur harms performance or a11y, fall back to opaque `surface-solid`.

---

## Elevation & shadow

Shadows express height, not drama.

| Level | Light shadow                      | Use                     |
| ----- | --------------------------------- | ----------------------- |
| `e0`  | none                              | Flat lists              |
| `e1`  | `0 1px 2px rgba(11,18,32,0.06)`   | Inputs resting optional |
| `e2`  | `0 4px 12px rgba(11,18,32,0.08)`  | Menus, popovers         |
| `e3`  | `0 12px 32px rgba(11,18,32,0.12)` | Modals                  |

Dark mode: lower opacity, slightly cooler black (`rgba(0,0,0,0.45)` max for e3).  
Prefer border+surface change over shadow for cards on mobile.

---

## Data color (charts)

| Series         | Token approach   |
| -------------- | ---------------- |
| Primary series | `lagoon`         |
| Secondary      | `ink-muted`      |
| Tertiary       | `reserve` at 80% |
| Negative       | `danger`         |
| Positive delta | `success`        |

Max 4 series on one chart without a legend collapse.

---

## Contrast requirements

- Body text on canvas/surface: **≥ 4.5:1**
- Large text / big balances (≥18px bold or ≥24px): **≥ 3:1**
- UI chrome / icons that convey meaning: **≥ 3:1**
- `ink-faint` never used for critical amounts or CTAs
- High-contrast mode boosts `ink-muted` toward `ink` and strengthens `line`

---

## Migration note (from current product)

Current tokens (`#0f6e56` on `#f7f4ef`) are a coherent but **warm-paper** dialect.  
Aether replaces them with **cool Mist + Lagoon** for a more distinct, less cliché premium identity.  
Implementation is Phase 2+; this document is the target truth.
