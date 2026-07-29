# 05 — Typography System

**System:** Aether Type  
**Principle:** Typography is navigation. Money is editorial.

---

## Font stack

| Role            | Family             | Fallback                                              | Why                                                                                   |
| --------------- | ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Brand / display | **Syne**           | `system-ui, sans-serif`                               | Architectural identity; memorable without gimmick                                     |
| UI / body       | **Manrope**        | `Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif` | Geometric calm, excellent UI metrics                                                  |
| Large balances  | **Source Serif 4** | `Georgia, Times New Roman, serif`                     | Dignity and trust for value (principle kinship with Apple Wallet — not a visual copy) |
| Mono            | **IBM Plex Mono**  | `ui-monospace, SFMono-Regular, Menlo, monospace`      | Addresses, hashes, order IDs                                                          |

**Loading:** `next/font` (or equivalent) with `display: swap`, subset Latin + figures.  
**Do not use:** Inter, Roboto as primary brand, Arial-only stacks, comic or display novelty fonts.

---

## Type roles

| Role         | Family          | Size    | Weight  | Line height | Letterspacing | Use                             |
| ------------ | --------------- | ------- | ------- | ----------- | ------------- | ------------------------------- |
| `display`    | Syne            | 40 / 48 | 700     | 1.1         | -0.02em       | Marketing / rare in-app moments |
| `title`      | Syne            | 28 / 32 | 700     | 1.15        | -0.015em      | Screen titles (sparingly)       |
| `heading`    | Manrope         | 22 / 24 | 650–700 | 1.25        | -0.01em       | Section headings                |
| `title-sm`   | Manrope         | 18      | 600     | 1.3         | -0.01em       | Card / sheet titles             |
| `body`       | Manrope         | 16      | 400–500 | 1.5         | 0             | Default reading                 |
| `body-sm`    | Manrope         | 14      | 400–500 | 1.45        | 0             | Secondary explanations          |
| `label`      | Manrope         | 13      | 600     | 1.3         | 0.01em        | Field labels, overlines         |
| `caption`    | Manrope         | 12      | 500     | 1.35        | 0.01em        | Timestamps, hints               |
| `balance-lg` | Source Serif 4  | 40 / 48 | 600     | 1.1         | -0.02em       | Home total balance              |
| `balance-md` | Source Serif 4  | 28      | 600     | 1.15        | -0.015em      | Asset detail header             |
| `balance-sm` | Manrope tabular | 16      | 600     | 1.3         | 0             | List row amounts                |
| `mono`       | IBM Plex Mono   | 13      | 400–500 | 1.4         | 0             | Addresses (truncate mid)        |
| `mono-sm`    | IBM Plex Mono   | 11      | 400     | 1.35        | 0             | Tx hashes                       |

Mobile may step `display` / `balance-lg` down one stop; never below readable trust thresholds.

---

## Modular scale

Base **16px**. Ratio ≈ **1.25** (major third) for UI; balances may jump the scale for drama.

```
11 · 12 · 13 · 14 · 16 · 18 · 22 · 28 · 32 · 40 · 48
```

Prefer tokens (`text.sm`, `text.md`…) over ad-hoc `clamp()` per experience CSS.

---

## Numeric typography

- Enable **tabular figures** for all monetary columns (`font-variant-numeric: tabular-nums`)
- Balances: always show currency/asset context (`$12,480.20` or `2.015 ETH`)
- Fiat approx under crypto: `caption` + `ink-muted`
- Never animate numerals if `prefers-reduced-motion: reduce` — snap to final

---

## Hierarchy rules

1. One `balance-lg` or one `title` dominates a screen — not both fighting.
2. Eyebrow/`label` above titles only when it clarifies context (network, wallet name).
3. Do not use `font-weight: 650` as a one-off; stick to 400 / 500 / 600 / 700.
4. All-caps is reserved for rare `label` overlines (max ~20 characters).

---

## Truncation

| Content     | Behavior                                        |
| ----------- | ----------------------------------------------- |
| Addresses   | `0x1234…ABCD` mid-truncate; full on expand/copy |
| Asset names | End truncate with tooltip on desktop            |
| Tx memos    | Two lines max then fade                         |

Always provide copy-to-clipboard for truncated cryptographic strings.

---

## Pairing examples

**Home header**

```
label (Manrope 13 / muted)     Aurora · Personal
balance-lg (Source Serif 48)   $24,180.42
body-sm (muted)                ≈ 8.2104 ETH · Updated just now
```

**List row**

```
body (600)        Ethereum
caption           8.2104 ETH
balance-sm        $24,180.42   (right aligned, tabular)
```

---

## Accessibility

- Minimum body 16px on mobile for primary reading paths
- Captions not sole carriers of critical fee / risk info
- Color not the only balance-change signal — include `+` / `−` text
- Line length for instructional copy: ~45–75 characters

---

## Migration note

Current product uses **IBM Plex Sans + IBM Plex Mono** throughout.  
Aether upgrades brand distinctiveness with **Syne + Manrope + Source Serif 4**, retaining Plex Mono for crypto strings.  
Roll out via shared tokens — do not mix Plex Sans headings with Syne on the same screen during transition.
