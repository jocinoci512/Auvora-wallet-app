# Auvora — Session Wallet / Alchemy Reconnect Fix

**Date:** 2026-08-01  
**Scope:** Diagnose and permanently eliminate indefinite reconnect hangs; preserve existing local wallets; verify read-only RPC; ship Android Alpha APK.  
**Broadcast kill switch:** `liveBroadcastEnabled = false` (unchanged)

---

## 1. Exact root cause of the reconnect hang

Two related failure modes were conflated:

### A) Alchemy CLI Agent Wallet session (dashboard approval)

`alchemy wallet connect --mode session` **blocks indefinitely** waiting for Dashboard Agent Wallet approval. When launched without an interactive TTY (Cursor/agent shells), it often emits **no progress stdout** and never times out. That is why reconnect “hung before dashboard approval.”

**This approval is optional for Auvora.** Auvora’s product wallet is the **on-device encrypted local wallet**. Alchemy session Agent Wallet is a CLI/agent convenience — not a gate for opening Home.

### B) Auvora app portfolio restore path (felt like infinite loading)

`SyncEngine.loadPortfolio()` awaited `NetworkManager.refresh()`, which probed **every chain sequentially** (multiple URLs × ~4s timeouts). On poor networks this could run for a very long time before Home felt “ready,” while HomeShell also **awaited** `portfolio.bootstrap()` before considering sync started.

**Neither path may recreate wallets.** Existing local Alchemy CLI addresses were verified still:

| Chain  | Address (preserved)                           |
| ------ | --------------------------------------------- |
| EVM    | `0xF69154cd3115741Acae4A3d0d757A9C3cCbd78d6`  |
| Solana | `CxyHsMTdRsKskLtSmXvcEvphjfzpk2pX3zwrrwGFH8t` |

---

## 2. Files changed

| File                                                      | Change                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/mobile/lib/wallet_engine/network_manager.dart`      | Parallel chain probes + **12s** hard ceiling                       |
| `apps/mobile/lib/wallet_engine/sync_engine.dart`          | Network/price refresh wrapped in timeouts; degrade instead of hang |
| `apps/mobile/lib/portfolio/portfolio_controller.dart`     | Bootstrap/refresh overall timeouts; keep cache                     |
| `apps/mobile/lib/ui/home_shell.dart`                      | Start SyncCoordinator **before** awaiting bootstrap; 22s ceiling   |
| `apps/mobile/lib/wallet_engine/sync_coordinator.dart`     | Resume refresh timeout + degraded path                             |
| `apps/mobile/lib/state/wallet_controller.dart`            | Splash bootstrap **12s** timeout — never stick on splash           |
| `apps/mobile/lib/connections/connections_controller.dart` | WC restore **8s** timeout                                          |
| `apps/mobile/lib/wallet_engine/rpc_health_probe.dart`     | Solana: `getHealth` **and** `getLatestBlockhash`                   |
| `apps/mobile/test/session_restore_timeout_test.dart`      | Activity merge preservation test                                   |
| `tools/alchemy_session_reconnect.ps1`                     | Bounded CLI session reconnect; **never** runs `--mode local`       |

---

## 3. Session restoration fix

On restart / unlock → dashboard:

1. Detect onboarded wallet + PIN → Unlock (unchanged).
2. After unlock, HomeShell paints immediately and starts SyncCoordinator.
3. Portfolio loads **cache first**, then soft-refreshes with hard timeouts.
4. RPC/market failure → degraded banners / cached figures — **dashboard stays open**.
5. Alchemy Agent Wallet session approval is **not** required to reach Home.
6. Optional CLI session reconnect: `tools/alchemy_session_reconnect.ps1` (timeout, preserve local keys).

---

## 4. Alchemy RPC verification results (read-only)

| Check                                      | Result                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Endpoint construction                      | `RpcEndpoints` prefers overrides → Alchemy (if `ALCHEMY_API_KEY` dart-define) → public defaults                         |
| API key in repo / logs                     | Not present; diagnostics use `alchemyKey: bool` + `/v2/••••` labels only                                                |
| Public ETH tip (`ethereum.publicnode.com`) | **OK** `eth_blockNumber`                                                                                                |
| Public ETH tip (`cloudflare-eth.com`)      | **FAIL** (provider `-32046`) — failover list covers this                                                                |
| Public Polygon tip                         | **OK**                                                                                                                  |
| ETH `eth_getBalance` (existing local EVM)  | **OK** `0x0`                                                                                                            |
| Alchemy-keyed tip from this host           | **Not run with a live key** (no key injected into this shell; compile-time dart-define only). Public failover verified. |

Live broadcast / gas estimation for send remains kill-switched by design.

---

## 5. Solana RPC verification results (independent)

| Check                                       | Result                                       |
| ------------------------------------------- | -------------------------------------------- |
| `getHealth` (`api.mainnet-beta.solana.com`) | **OK**                                       |
| `getLatestBlockhash`                        | **OK**                                       |
| `getBalance` (existing local Solana)        | **OK** `value=0`                             |
| App probe                                   | Now requires health **and** latest blockhash |

---

## 6. Dashboard navigation verification

| Step                            | Behavior                                     |
| ------------------------------- | -------------------------------------------- |
| Splash → Unlock / Welcome       | Bootstrap timeout prevents infinite splash   |
| Unlock → Home                   | Immediate; sync non-blocking                 |
| Alchemy session pending/timeout | Does **not** block Home                      |
| WC restore failure/timeout      | Session marked/restored best-effort; no hang |
| RPC degraded                    | Banners + cached portfolio                   |

---

## 7. Timeout / retry behavior

| Operation                          | Bound                    |
| ---------------------------------- | ------------------------ |
| WalletController bootstrap         | 12s                      |
| NetworkManager multi-chain refresh | 12s parallel ceiling     |
| Per-URL RPC probe                  | 4s (existing)            |
| SyncEngine network refresh         | 14s                      |
| Price bootstrap                    | 12s                      |
| Portfolio repo load                | 18s                      |
| Portfolio bootstrap overall        | 20s                      |
| HomeShell bootstrap await          | 22s                      |
| SyncCoordinator resume refresh     | 12s                      |
| WC session restore                 | 8s                       |
| CLI session reconnect script       | Default 120s then exit 4 |

Every bound ends in SUCCESS, FAILURE, or TIMEOUT — no infinite spinner path on these awaits.

---

## 8. Existing-wallet preservation verification

- Did **not** run `alchemy wallet connect --mode local --force`.
- Did **not** delete `~/.config/alchemy/wallet-keys`.
- Did **not** wipe Flutter `SecureKeyStore` / mnemonics.
- Confirmed CLI local addresses unchanged after fix work.
- Reconnect script explicitly refuses local key regeneration.

---

## 9. Tests performed

| Suite                                            | Result                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `flutter analyze lib test`                       | **No issues found**                                                    |
| `session_restore_timeout_test`                   | **Pass**                                                               |
| `integration_config_test`                        | **Pass**                                                               |
| `reliability_test`                               | **Pass**                                                               |
| Public EVM/Solana RPC probes                     | **Pass** (with Cloudflare failover noted)                              |
| Physical device matrix (rotation, battery, etc.) | **Not available on this Windows host** — retest on device with new APK |

---

## 10. Remaining external configuration requirements

| Item                                               | Status                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `ALCHEMY_API_KEY` via `--dart-define` / CI secrets | Optional for tip preference; public RPCs work                      |
| Alchemy Dashboard Agent Wallet session approval    | Optional for CLI agents; use `tools/alchemy_session_reconnect.ps1` |
| Reown `WC_PROJECT_ID` + live SDK                   | Still preview; not required for Home                               |
| Live broadcast unlock                              | Separate security gate — **do not** enable for this fix            |

---

## Android APK

Path: `D:\auvora-build\dist\alpha-1.0.0-session-reconnect\auvora-wallet-1.0.0-alpha-session-reconnect.apk`  
Size: ~41.0 MB (arm64)  
SHA-256: `AA926EC293ED4AFA871FFCFC5DE424824EF834A53A8F1E9D433528D5FE552BDD`

---

## What “dashboard approval” means

In **Alchemy CLI / Agent Wallets**, it is a browser/dashboard grant for a **delegated session signer**. It is **not** Auvora’s in-app PIN/biometric unlock and must never block product navigation when a local encrypted wallet already exists.
