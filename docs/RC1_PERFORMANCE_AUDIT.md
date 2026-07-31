# RC1 Performance Audit Report

**Build:** `1.1.0-rc.1` · 2026-07-31  
**Verdict:** **PASS for Closed Alpha** (host-validated) · physical battery/FPS lab open

---

## Measurements (this host)

| Metric                     | Result                          |
| -------------------------- | ------------------------------- |
| Flutter unit/widget suite  | 93 passed                       |
| Android release APK        | **75.2MB**                      |
| Web First Load JS (shared) | ~103 kB                         |
| Icon font tree-shake       | ~99% reduction on MaterialIcons |

---

## Architecture retained from Prompt 8

- Cache-first portfolio paint
- Sync coalesce + debounce + reconnect/resume
- Pending-tx soft poll only when pending > 0
- Price dual-write to namespaced cache
- RPC ping timeout + labeled failover
- Offline queue for safe deferred work only

---

## Not claimed / remaining

| Item                                        | Status                  |
| ------------------------------------------- | ----------------------- |
| OS background sync (WorkManager / BGTask)   | Not wired (KI-M06)      |
| Live multi-URL RPC pools                    | Waits on live broadcast |
| Physical FPS / jank traces                  | Open                    |
| Battery drain long-session                  | Open (KI-M04 related)   |
| Impeller / image disk cache instrumentation | Minimal                 |

---

## Recommendation

Performance is adequate for Closed Alpha preview use. Run device lab (startup, scroll jank, offline stress) before Public Beta.
