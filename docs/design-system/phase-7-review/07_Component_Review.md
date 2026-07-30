# 07 — Component Review

## Consistency

| Surface                 | Shell                   | Notes                                           |
| ----------------------- | ----------------------- | ----------------------------------------------- |
| Assistant               | PlatformShell           | `.cx-chat*`                                     |
| Insights                | PlatformShell           | Score ring shared with Security                 |
| Learn                   | PlatformShell           | List + lesson panel (no fake card destinations) |
| Portfolio               | PlatformShell + dash/pf | Charts reused deliberately                      |
| Privacy / Notifications | PlatformShell           | Prefs extended                                  |

## Issues found & fixed

1. Education Hub advertised “~N min” lessons but only deep-linked elsewhere — **real lesson bodies**.
2. Smart alerts looked like live inbox events — **Preview badge + Example copy**.
3. Component API: insights now require `badge` field — single generator sets it.

## Loading / error handling

| Surface              | Loading           | Error                                |
| -------------------- | ----------------- | ------------------------------------ |
| Assistant            | N/A (sync)        | Off-state warn                       |
| Insights / Portfolio | Sync demo         | Demo honesty banners                 |
| Notifications        | Existing API path | Demo fallback + preview smart alerts |
| Permissions          | Existing          | Marks review on visit                |

## Typography / spacing

Aether serif amount display retained. Score row uses flex wrap + `.cx-score-copy` for tablet/mobile.
