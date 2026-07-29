# Bridge UI

**Route:** `/bridge`  
**Component:** `apps/web/src/components/trading/BridgeExperience.tsx`

## Features

| Capability                        | Implementation                              |
| --------------------------------- | ------------------------------------------- |
| Source / destination networks     | Dual selectors; flip control                |
| Bridge routes                     | Route summary from quote                    |
| Providers                         | Best + alternatives selectable              |
| Estimated arrival                 | `formatSeconds(estimatedCompletionSeconds)` |
| Fee breakdown                     | Bridge fee + gas estimate                   |
| Confirmation / progress / success | Screen machine                              |
| History                           | Demo bridge transfers                       |

## API

- Live: `GET /bridge/networks`, `POST /bridge/quote`, prepare/confirm when available
- Offline: simulator quote

## Accessibility

- Separate radiogroups for source, destination, and provider
