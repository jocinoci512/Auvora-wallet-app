# Offline Experience — Auvora Wallet (Task 034)

## Status

**Offline Status: Resilient soft-degrade**

## Capabilities

| Feature                      | Implementation                                            |
| ---------------------------- | --------------------------------------------------------- |
| Offline detection            | `navigator.onLine` + `online`/`offline` events            |
| Connection restoration toast | Success toast via `OnlineStatusProvider`                  |
| Offline banner               | Sticky `auvora-network-banner` (`role="status"`)          |
| Offline empty state          | `OfflineState` in `@auvora/ui`                            |
| Soft gate                    | `OfflineAware` optional block + retry                     |
| Cached portfolio / metadata  | `lib/offline/cache.ts` TTL localStorage                   |
| Cached profile               | Account settings uses `withOfflineCache` for `/api/v1/me` |
| Demo graceful degradation    | Existing experience demo fallbacks retained               |
| Retry workflows              | Toast guidance + `useRetryWhenOnline` helper              |

## Cache namespaces

- `portfolio` — holdings + performance snapshot
- `asset-meta` — symbol/name/network metadata
- `me-profile` — auth `/me` profile payload

## Notifications

Offline and restore events use the shared toast system (warning / success) for consistency with transaction and security toasts.

## Limits

This is **client soft-cache**, not a full service worker / PWA install surface. Service worker offline shells can be added later without changing API contracts.
