# 04 — Smart Alerts

## Purpose

Intelligent notifications users fully control: large transfers, fee spikes, suspicious approvals, staking rewards, insight tips, portfolio health reminders.

## Surfaces

| Surface                   | Role                                                   |
| ------------------------- | ------------------------------------------------------ |
| `/settings/notifications` | Per-category toggles                                   |
| `/notifications`          | Inbox + **Smart alerts** panel filtered by local prefs |
| Demo seed                 | `DEMO_SMART_ALERTS` in `lib/insights/demo.ts`          |

## New preference keys (`NotificationPrefsLocal`)

| Key               | Alert type             |
| ----------------- | ---------------------- |
| `largeTransfers`  | Large in / out         |
| `highNetworkFees` | Elevated gas           |
| `insightAlerts`   | Portfolio tips         |
| `portfolioHealth` | Health recommendations |

Existing keys retained: transactions, price, security, staking, marketing, product, web3.

## Behavior

- Smart alerts render only when the matching preference is not `false`.
- Marketing remains off by default.
- Copy stays situational and educational (“consider waiting”, “revoke unused grants”).

## Quality gates

| Gate                | Status |
| ------------------- | ------ |
| User control        | Pass   |
| Preference wiring   | Pass   |
| No fund-moving CTAs | Pass   |
