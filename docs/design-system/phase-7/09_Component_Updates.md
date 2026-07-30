# 09 — Component Updates

## New

| Component / module        | Path                                                  |
| ------------------------- | ----------------------------------------------------- |
| AuvoraAssistantExperience | `components/assistant/AuvoraAssistantExperience.tsx`  |
| InsightsExperience        | `components/insights/InsightsExperience.tsx`          |
| EducationHubExperience    | `components/learn/EducationHubExperience.tsx`         |
| Insights demo engine      | `lib/insights/demo.ts`                                |
| Routes                    | `/assistant`, `/insights`, `/learn`; `/ai` → redirect |

## Extended

| Area                           | Change                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| PortfolioExperience            | PlatformShell Smart Portfolio + health + insights teaser + network alloc  |
| PrivacyCenterExperience        | AI assistant + local history switches                                     |
| NotificationSettingsExperience | Smart alert preference labels                                             |
| NotificationCenterExperience   | Smart alerts panel filtered by prefs                                      |
| SettingsHomeExperience         | Assistant / Learn / Insights entries; richer Privacy / Notifications copy |
| Nav                            | Insights + Assistant primary; Learn in More                               |
| prefs.ts                       | `aiAssistant`, `aiChatHistory`, insight/health/fee/large-transfer keys    |
| core-experience.css            | `.cx-chat*` bubble / form styles                                          |

## Unchanged (respected)

PlatformShell, SettingsSectionNav, dashboard charts, security score ring patterns, existing notification API client paths.

## Strengthening Aether

Chat primitives reuse `cx-panel`, `cx-chip`, `cx-btn`, `cx-field`, `cx-score-ring` — no new visual language beyond chat bubbles.
