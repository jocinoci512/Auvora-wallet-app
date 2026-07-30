# 02 — Portfolio Review

## Verdict

Smart Portfolio direction is right. **Invented unrealized P/L was a launch-blocking trust bug** and is fixed.

## Critical issues found

1. **Fabricated P/L:** When `costBasisUsd` was missing, UI used `valueUsd * 0.08` and `change24hPct * 4` — false numbers presented as unrealized gains.
2. **Illustrative mini-charts** looked like live price history without labeling.
3. **Duplicate / soft honesty** between PlatformShell reassure and info banner — consolidated.
4. **Inline style** on health copy column — replaced with `.cx-score-copy`.

## Displays reviewed

| Signal                        | Status                              |
| ----------------------------- | ----------------------------------- |
| Total + unrealized (estimate) | Pass — labeled                      |
| Realized gains                | Honest “not booked in demo”         |
| Best / worst 24h              | Pass                                |
| Historical performance        | Demo series — OK with sample banner |
| Token / network allocation    | Pass                                |
| Health + insight teaser       | Pass after score honesty fixes      |
| Holdings expand               | Pass — no fake basis                |

## Typography / spacing / consistency

Still mixes `cx-*` panels with `dash-*` / `pf-*` chart chrome. Acceptable for Phase 7; unify later (see 09). Desktop/tablet grids from dashboard CSS remain usable; mobile filters stack via existing toolbar.

## Loading / errors

No async load yet (demo sync). Offline cache write retained. When live balances land, add skeleton + failure strip — tracked in remaining recommendations.
