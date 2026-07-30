# 07 — Privacy Framework

## Purpose

Ensure intelligence features respect privacy: minimal data, local-first history, explainability, and user kill switches.

## Controls

| Pref                                  | Default                 | Effect                                                      |
| ------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `aiAssistant`                         | on                      | Disables Assistant send / prompts when off                  |
| `aiChatHistory`                       | on                      | When off, history is not persisted; Clear removes local key |
| Analytics / cookies / personalization | existing Privacy Center | Unchanged Phase 6 behavior                                  |

**UI:** Privacy Center → “Auvora Assistant” panel + links to Assistant / Learn.

## Data posture

| Data                   | Treatment                                                   |
| ---------------------- | ----------------------------------------------------------- |
| Recovery phrase / keys | Never collected by Assistant                                |
| Chat history           | Device `localStorage` only (`auvora_assistant_history_v1`)  |
| Portfolio insights     | Computed client-side from holdings demo / wallet data       |
| Cloud chat             | Optional when signed in; documented as never receiving keys |

## Explainability

Assistant always shows “How answers are made”: curated on-device matching; optional API chat when signed in.

## Quality gates

| Gate                         | Status |
| ---------------------------- | ------ |
| Privacy                      | Pass   |
| Security (no phrase prompts) | Pass   |
| User control                 | Pass   |
