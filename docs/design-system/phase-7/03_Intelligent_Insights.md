# 03 — Intelligent Insights

## Purpose

Non-invasive observations that educate: concentration, idle stables, staking rewards, fee windows, security, tax reminders, milestones. Never pressure trades.

## Surface

- **Route:** `/insights`
- **Component:** `apps/web/src/components/insights/InsightsExperience.tsx`
- **Engine:** `buildPortfolioInsights()` in `lib/insights/demo.ts`
- **Teaser:** top 3 insights on Smart Portfolio

## Insight kinds

`concentration` · `idle` · `rewards` · `security` · `milestone` · `fees` · `tax` · `diversify`

Severity is informational: `info` | `tip` | `watch` — badges use existing `cx-badge` tones, not alarmist red for education.

## Tone rules

1. “That is fine if intentional…”
2. “One quiet day is not a thesis change.”
3. “Claiming is optional — fees may apply.”
4. Tax copy: “not tax advice.”

## User control

Footer links to notification prefs (`insightAlerts`) so users can quiet tips without losing the Insights page.

## Quality gates

| Gate                              | Status |
| --------------------------------- | ------ |
| Non-invasive copy                 | Pass   |
| No shame language                 | Pass   |
| Deep links to actionable settings | Pass   |
