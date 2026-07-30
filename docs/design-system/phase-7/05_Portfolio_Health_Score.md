# 05 — Portfolio Health Score

## Purpose

A single encouraging indicator of portfolio + protection hygiene. Recommendations improve the score; language never shames.

## Engine

`computePortfolioHealthScore(holdings)` in `lib/insights/demo.ts`.

### Factors (weighted)

| Factor               | Weight | Pass condition (demo)                          |
| -------------------- | ------ | ---------------------------------------------- |
| Diversification      | 20     | Max allocation &lt; 50% and ≥ 3 holdings       |
| Network spread       | 15     | ≥ 2 networks                                   |
| Wallet PIN           | 20     | Security prefs PIN enabled                     |
| Recovery verified    | 25     | Backup prefs phrase verified                   |
| Permission awareness | 10     | Always pass in demo; links to Web3 permissions |
| Portfolio reviewed   | 10     | Total value &gt; 0                             |

Score = round(earned weights / max weights × 100).

## Surfaces

- Smart Portfolio health ring + open factors
- Insights page health panel
- Smart alert reminder when `portfolioHealth` pref is on

## Tone

- “Improve any item below at your pace.”
- “Looking solid — keep reviewing…”
- Actions are soft: Review allocation, Practice recovery, Enable PIN.

## Quality gates

| Gate                               | Status              |
| ---------------------------------- | ------------------- |
| Encouraging, not shaming           | Pass                |
| Actionable deep links              | Pass                |
| Live-gated security/backup factors | Pass (client prefs) |
