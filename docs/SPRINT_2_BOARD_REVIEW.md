# Sprint 2 — Board Review & Hardening

## Board verdict

**CONDITIONAL PASS** for closed-beta / design preview. Not unrestricted GA (live balances + rails still Sprint 3).

After refinement, the dashboard answers the three jobs clearly: **my money → what I can do → recent activity**. Cognitive load is lower; engineering clutter is off the primary surface.

## Findings → fixes

| Weakness                          | Fix                                                                         |
| --------------------------------- | --------------------------------------------------------------------------- |
| 5-tab nav + Search as destination | 4 tabs (Home / Assets / Activity / More); search is full-screen overlay     |
| Header icon cluster (4+)          | Hide balances, search, profile only; security as green pip under greeting   |
| 7 equal quick actions             | 4 primary (Send / Receive / Swap / Buy); Sell·Bridge·Stake in sheet         |
| Preview banner + “Empty view” CTA | Quiet one-line under portfolio; sample toggle buried in More → Preview data |
| Nested card soup                  | Cardless money block; lighter surface tiles                                 |
| Fiat secondary to crypto          | Fiat value lead on asset rows                                               |
| Desktop = stretched phone         | Two-column Home (money+actions \| assets+activity)                          |
| Search without autofocus          | Full-screen search focuses field immediately                                |
| Receive dead-end sheet            | Receive copies live address from sheet                                      |
| a11y gaps                         | Semantics on money, assets, txs, actions; 48px targets                      |

## Board questions (post-fix)

| Question                           | Answer                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| First-time user understands?       | **Yes** — “Your money”, four actions, activity                    |
| Inspires confidence?               | **Yes** for on-device keys + calm UI; honesty on preview figures  |
| Faster / more polished than peers? | **Directionally yes** on calm hierarchy; live speed TBD with sync |
| Reduces cognitive load?            | **Yes** — fewer tabs, fewer primary actions, quieter chrome       |
| Unnecessary elements removed?      | **Yes** — Search tab, debug CTAs on Home, noisy banner            |

## Still Sprint 3

Live balances, wired money flows, real offline price paths, system share/explorer launch, notification inbox.
