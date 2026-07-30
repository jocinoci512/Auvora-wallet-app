# Phase 7 — AI Assistant · Smart Portfolio · Intelligent Insights

Aether intelligence layer: calm explanations, portfolio health, educational insights, smart alerts, and a beginner Education Hub — without replacing user decisions or exposing keys.

**Shared shell:** `apps/web/src/components/platform/PlatformShell.tsx`  
**Insights engine (demo):** `apps/web/src/lib/insights/demo.ts`  
**Styles:** `apps/web/src/app/core-experience.css` (`.cx-chat*`)  
**Preserved:** dashboard holdings/performance demos, settings prefs, notification APIs, PlatformShell patterns

| Doc | Topic                       |
| --- | --------------------------- |
| 01  | Auvora Assistant            |
| 02  | Smart Portfolio             |
| 03  | Intelligent Insights        |
| 04  | Smart Alerts                |
| 05  | Portfolio Health Score      |
| 06  | Education Hub               |
| 07  | Privacy Framework           |
| 08  | AI Experience               |
| 09  | Component Updates           |
| 10  | Accessibility Report        |
| 11  | Performance Report          |
| 12  | Final Implementation Report |

## Routes

| Path                      | Surface                 |
| ------------------------- | ----------------------- |
| `/assistant`              | Auvora Assistant        |
| `/ai`                     | Redirect → `/assistant` |
| `/portfolio`              | Smart Portfolio         |
| `/insights`               | Insights + health       |
| `/learn`                  | Education Hub           |
| `/settings/privacy`       | AI + data toggles       |
| `/settings/notifications` | Smart alert prefs       |
| `/notifications`          | Inbox + smart alerts    |

## Principles

1. Educate, never pressure or shame.
2. Never move funds or request recovery phrases.
3. Explain how recommendations are generated.
4. User control over AI and every alert category.
5. Improve Aether — do not invent a parallel design system.
