# 03 — Insight Review

## Verdict

Insights educate calmly after **accuracy gates** — no more always-on staking/idle tips for portfolios that do not hold those assets.

## Critical issues found

1. **Always-on staking tip** even with no stakeable context framing → gated + “if you stake” language.
2. **Idle stables tip** with no stables in demo holdings → only when stable symbols present.
3. **Permission tip** always present → only when permissions not yet reviewed.
4. **Raw severity badges** (`watch` / `tip`) → human badges (“Worth a look”, “Tip”, “Info”).
5. **Missing explainability** on Insights page → “How insights are made” panel.
6. **Advice-adjacent idle copy** scrubbed.

## Health score (coupled)

| Factor              | Issue                           | Fix                                                         |
| ------------------- | ------------------------------- | ----------------------------------------------------------- |
| Permissions         | Always `ok: true` (free points) | Live-gated via `auvora_perm_review_v1` on Permissions visit |
| “Reviewed recently” | `total > 0` always true on demo | Removed — meaningless                                       |
| Empty holdings      | `Math.max(...[])` → `-Infinity` | Guarded                                                     |
| Network link        | Pointed at Insights             | Points at Portfolio                                         |

## Tone

Concentration and movers now say **estimate / not a recommendation**. Tax line keeps “not tax advice.”

## Trust signal

Demo banner on Insights is required until live balances drive the engine.
