# Master Build Prompt 8 of 10 — Performance • Reliability • Offline • Infrastructure

**Date:** 2026-07-31  
**Channel:** Mobile `1.1.0-beta.2` Closed Beta  
**Scope:** Harden sync, cache, offline, network resilience, diagnostics, and release gates — no new user-facing product features  
**Status:** Complete for software + Android APK + web companion on this host; iOS requires macOS

---

## Audit summary

Sprint 9 already owned the reliability stack (`SyncEngine`, `SyncCoordinator`, `NetworkManager`, `CacheStore`, retry helpers, soft offline UX, Diagnostics, `ReleaseConfig`). Prompt 8 **extended those systems in place** — no duplicate sync/cache layers.

Gaps closed:

| Gap                      | Resolution                                                              |
| ------------------------ | ----------------------------------------------------------------------- |
| Unused cache namespaces  | Prices + Help + Diagnostics wired; selective purge                      |
| Thin coordinator metrics | Duration, resume/pause, pending-tx tick, queue drain                    |
| RPC failover theater     | Labeled primary→backup→fallback with timeouts                           |
| Offline deferred work    | Safe `OfflineActionQueue` (never sign/send)                             |
| Diagnostics depth        | Sync duration, error events, cache sizes, failover counters             |
| Corrupt cache recovery   | Drop on read (mobile + web)                                             |
| OS background sync       | Honest: not wired; foreground resume / reconnect / health timers remain |

**Kill switches unchanged:** `liveBroadcastEnabled=false`, `allowFundingAddresses=false`.

---

## 1. Performance improvements

- Cache-first portfolio path retained; namespaced SWR for portfolio / prices / tx history
- Sync coalescing + debounce unchanged; pending-tx soft poll only when pending > 0
- Price dual-write to `CacheStore.nsPrices` avoids duplicate cold fetches after restart
- Help FAQ warm-on-open so Support stays readable offline
- Web Help caches FAQ bundle; Advanced Settings can purge expired entries
- Android release tree-shook Material icons (~99% icon font reduction); APK **75.3MB**

---

## 2. Architecture improvements

- Single reliability path: `reliability/` + wallet_engine sync/network — no parallel stack
- `OfflineActionQueue` for safe deferred work only
- `ReleaseConfig` soft flags: `clientDiagnosticsEnabled`, `offlineQueueEnabled`, `aggressiveCachePurge`
- Web offline cache namespaces expanded (`help`, `prices`, `settingsSafe`) with purge APIs
- Coordinator documents that WorkManager / BGTaskScheduler are **not** claimed on this host

---

## 3. Reliability improvements

- Partial chain failure still paints prior cache for failed chains
- Offline load returns last portfolio with clear offline/fromCache flags
- Network: DNS dual-lookup + `forceOffline` test hook + ping timeout (3s) + failover labels
- Retry with exponential backoff retained for GET/read paths
- Corrupt SharedPreferences / localStorage envelopes deleted on read
- Queue auto-drains on successful online sync

---

## 4. Cache strategy

| Namespace     | TTL (typical) | SWR on purge        |
| ------------- | ------------- | ------------------- |
| portfolio     | 12h           | kept                |
| prices        | 45m           | kept                |
| tx-history    | 6h            | kept                |
| help          | 7–14d         | purged when expired |
| network-meta  | 15m           | purged when expired |
| diagnostics   | 24h           | purged when expired |
| settings-safe | as written    | purged when expired |

Selective invalidation via `clearNamespace` / `clearAll` / `purgeExpired`.

---

## 5. Synchronization strategy

Triggers: start, manual, resume, reconnect, pending-tx (90s while pending), 45s endpoint health.  
In-flight refreshes coalesce. Auto-refresh respects Preferences `autoRefresh`.  
Reconnect forces refresh even if auto-refresh is off.  
No OS background fetch claimed until WorkManager / BGTask land on macOS/Android tooling.

---

## 6. Diagnostics implemented

- Cold start ms, last sync duration, sync sample count, error events
- Cache hits/misses, RPC request/failure, retries, partial failures
- Coordinator: reconnect / resume / pause / pending / coalesced / queue drained
- Network: failover attempts, timeout events, per-endpoint latency/state
- Export JSON marked `privacy: no_keys_seeds_pins`
- UI: purge expired + clear all

---

## 7. Remaining technical debt

- OS-level background sync (WorkManager / BGTaskScheduler) not implemented
- Live multi-URL RPC pools wait on `liveBroadcastEnabled`
- Image disk cache / Impeller profiling not instrumented beyond app metrics
- PWA service worker optional and not added
- Full ARB localization still English-only (Prompt 7 debt)
- iOS production archive requires macOS CI/host

---

## 8. Android build status

**PASS** — `flutter build apk --release`  
Output: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (**75.3MB**)

---

## 9. iOS build status

**BLOCKED on this Windows host** — `flutter build ios` is unavailable / not supported here. Same exception as Prompts 1–7. Archive on macOS CI.

---

## 10. Web build status

**PASS** — `pnpm build` (Next.js 15 production)  
Typecheck: PASS · Jest offline/retry: PASS (5 tests)

---

## Verification

| Check                    | Result            |
| ------------------------ | ----------------- |
| Flutter tests            | **93** passed     |
| Web typecheck            | PASS              |
| Web unit (cache + retry) | PASS              |
| Android release APK      | PASS (75.3MB)     |
| Web production build     | PASS              |
| iOS production           | Blocked (Windows) |
| Kill switches            | OFF               |

---

## Key files touched

- `apps/mobile/lib/reliability/offline_queue.dart` (new)
- `apps/mobile/lib/reliability/cache_store.dart`
- `apps/mobile/lib/wallet_engine/sync_coordinator.dart`
- `apps/mobile/lib/wallet_engine/network_manager.dart`
- `apps/mobile/lib/wallet_engine/sync_engine.dart`
- `apps/mobile/lib/wallet_engine/price_service.dart`
- `apps/mobile/lib/wallet_engine/models.dart`
- `apps/mobile/lib/ui/settings/diagnostics_screen.dart`
- `apps/mobile/lib/ui/settings/help_support_screen.dart`
- `apps/mobile/lib/release/release_config.dart`
- `apps/mobile/test/reliability_test.dart`
- `apps/web/src/lib/offline/cache.ts` (+ `cache.test.ts`)
- `apps/web/src/components/settings/HelpSupportExperience.tsx`
- `apps/web/src/components/settings/AdvancedSettingsExperience.tsx`

---

## Self-review verdict

Principal / Platform / Performance / Infra / QA / Security: Prompt 8 objectives met for Closed Beta on this host. Reliability hardened without inventing a second architecture. Remaining debt is correctly labeled (OS background sync, live RPC, iOS macOS). Ready for Master Build Prompt 9 when you start it.
