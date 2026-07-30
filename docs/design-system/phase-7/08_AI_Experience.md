# 08 — AI Experience

## Design stance

Auvora is an intelligent financial companion, not an autonomous trader.

| Principle            | Implementation                                 |
| -------------------- | ---------------------------------------------- |
| Inform, don’t decide | Insights and Assistant explain; no auto-swap   |
| Calm                 | Mist/Lagoon Aether; soft badges; no alarm spam |
| Private              | Local prefs + history; Privacy Center          |
| Trustworthy          | Honest demo labels; fee / tax disclaimers      |
| Controllable         | AI off, history off, per-alert toggles         |

## Journey map

1. Portfolio → health + insight highlights
2. Insights → full list + health factors
3. Assistant → ask “why” in plain language
4. Learn → longer curriculum
5. Alerts → opt-in situational reminders
6. Privacy → turn intelligence down or off

## What we deliberately did not build

- Auto-rebalancing or “AI trades”
- Personality chatbots that create dependency
- Shadow dark-pattern urgency on concentration tips
- A separate `/settings/ai` page (controls live in Privacy + Notifications)

## Quality gates

| Gate                                | Status                                      |
| ----------------------------------- | ------------------------------------------- |
| AI explainability                   | Pass                                        |
| UX                                  | Pass                                        |
| Production readiness (demo + hooks) | Conditional pass — live model routing later |
