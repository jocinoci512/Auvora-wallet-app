# Auvora Wallet — Reown / WalletConnect Production Integration Report

**Date:** 2026-08-02  
**Scope:** Wallet-side WalletConnect / Reown WalletKit integration for Auvora (self-custody).  
**Workspace:** `D:\auvora-wallet` only  
**Secret rule:** `WC_PROJECT_ID` presence only — value never printed. No Reown Secret. No Alchemy key in APK.

---

## Executive summary

Auvora now integrates **official `reown_walletkit` 1.3.8** behind the existing `WalletConnectProviderPort` / `ConnectionsController` architecture. When `WC_PROJECT_ID` is compiled via `--dart-define`, the app initializes live Reown WalletKit; on failure it falls back to `PreviewWalletConnectProvider` **without silently claiming live**. EVM methods `personal_sign`, `eth_signTypedData_v4`, and `eth_sendTransaction` are supported with local on-device signing; `eth_sign` is rejected. **`liveBroadcastEnabled` remains `false`** — WC cannot bypass the kill switch. Physical dApp QR pairing / Reown dashboard activity require device verification.

---

## 1. Audit of existing WC code

| Area                                           | Classification                 | Notes                                            |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| `PreviewWalletConnectProvider`                 | **preview-mock** (kept)        | Local pairing / sessions; `isLiveRelay == false` |
| `WalletConnectProviderPort`                    | **production seam** (extended) | Reused by live + preview                         |
| `ConnectionsController`                        | **production** (extended)      | Pairing, sessions, Activity, auth gates          |
| UI (`connect_dapp`, Permission Center, sheets) | **production** (copy updated)  | Never auto-approve                               |
| `WC_PROJECT_ID` in `IntegrationConfig`         | **production hook**            | dart-define only                                 |
| Live Reown SDK (pre-sprint)                    | **incomplete / missing**       | Now added                                        |
| Deep links (`wc:`, `auvora://wc`)              | **production**                 | Already in AndroidManifest                       |
| BTC / TRON / Solana WC                         | **unsupported** (documented)   | Not advertised                                   |

---

## 2. Project ID loading

| Check                                       | Result                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Root `.env` `WC_PROJECT_ID` present         | **YES**                                                                    |
| Mobile `.env`                               | **NO** (not used; Flutter does not auto-load root `.env`)                  |
| Loaded by Android build via `--dart-define` | **YES** (build script)                                                     |
| Reown init path                             | Attempts live init when Project ID configured; preview fallback on failure |
| Placeholder silent use                      | **Refused** — empty / `your_project_id` / `placeholder` rejected           |

**REOWN PROJECT CONFIGURED:** YES (local env + dart-define injection for Alpha APK)

---

## 3. Official Reown SDK

| Item             | Value                                             |
| ---------------- | ------------------------------------------------- |
| Package          | `reown_walletkit`                                 |
| Version resolved | **1.3.8** (`^1.3.8`; 1.4.0 available, not forced) |
| Related          | `reown_core` 1.3.8, `reown_sign` 1.3.8            |
| Signing helpers  | `web3dart` 2.7.3, `eth_sig_util` 0.0.9 (direct)   |

---

## 4. Wallet-side architecture

```
dApp → WC URI / QR / deep link
  → Reown WalletKit.pair()
  → onSessionProposal → ConnectionsController pending request (UI)
  → user biometric/PIN → approveLiveProposal (EVM namespaces only)
  → session persisted (SDK + SharedPreferences)
  → onSessionRequest / registered handlers
  → parse → human review sheet → auth → local sign → respondSessionRequest
```

Preview path remains available behind explicit non-live status.

---

## 5. Pairing

- Live: `pairUri(wc:…)` with 25s timeout; malformed/expired fail with StateError
- QR / paste / deep link reuse existing Connect + `DeepLinkListener`
- **Never auto-approve**
- Physical QR with real dApp: **DEVICE VERIFICATION REQUIRED**

---

## 6. Session proposal UI

Shows: dApp name, origin/URL, icon hint, networks, methods, events, permissions, risk warnings, Reown proposal id when live. Approve / Reject with `authenticateConnectionsAction`.

---

## 7. Chain / account mapping

| Network         | WC CAIP      | Advertised                                       |
| --------------- | ------------ | ------------------------------------------------ |
| Ethereum        | `eip155:1`   | YES                                              |
| BNB Smart Chain | `eip155:56`  | YES                                              |
| Polygon         | `eip155:137` | YES                                              |
| Bitcoin         | —            | **NO** (unsupported WC)                          |
| Tron            | —            | **NO**                                           |
| Solana          | —            | **NO** (not production-capable in Auvora WC yet) |

Unsupported namespaces documented in `WcChainCatalog.unsupportedNamespacesDocumented`.

---

## 8. Signing request security

Pipeline: validate session/chain/method → `WcRequestParser` → human-readable sheet → biometric/PIN → `EvmLocalSigner` (HD key on device) → WC response.  
Keys/mnemonic never logged, never sent to Reown/dApp/backend. Raw payload not persisted for signatures.

---

## 9. Supported methods

| Method                 | Status                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `personal_sign`        | Supported (local sign)                                     |
| `eth_signTypedData_v4` | Supported (local sign via eth_sig_util)                    |
| `eth_sendTransaction`  | Parse/preview; **broadcast refused** while kill switch off |
| `eth_sign`             | **Rejected** (unsafe)                                      |
| Unknown                | Rejected with SDK unsupported error                        |

---

## 10. Live broadcast safety

- `ReleaseConfig.liveBroadcastEnabled = false` (unchanged)
- WC `eth_sendTransaction` approval returns controlled error to dApp
- Same kill switch as Auvora Send — no second broadcast path

**LIVE TRANSACTION BROADCAST: MUST REMAIN NO** ✓

---

## 11. Biometric / passcode

WC approvals reuse `authenticateConnectionsAction` (same as prior Web3 path) — no weaker path.

---

## 12. Session management

- Active sessions in Permission Center + SharedPreferences
- Live topics via Reown SDK restore
- Expiry cleanup + remote `sessionDeletes`
- Disconnect user + dApp
- Restored sessions do not silently gain new permissions

Physical restart restore with live relay: **DEVICE VERIFICATION REQUIRED**

---

## 13. More / WC UI

Connect dApp, Permission Center, Web3 activity updated for live vs preview status. No unrelated redesign.

---

## 14. Activity integration

WC connect / reject / sign / tx / disconnect / security events append to existing `Web3ActivityEvent` pipeline. Broadcast-locked txs recorded as refused preview — no duplicate history system.

---

## 15. Reown analytics / dashboard

Legitimate traffic requires device pairing against a dApp using this Project ID.  
**REOWN DASHBOARD ACTIVITY: DEVICE VERIFICATION REQUIRED** (not faked from mocks)

---

## 16. Failure handling

| Case                     | Behavior                                 |
| ------------------------ | ---------------------------------------- |
| No Project ID            | Preview provider; clear status           |
| Init failure             | Preview fallback; reason stored          |
| Invalid/expired URI      | ArgumentError / StateError; snackbar     |
| Unsupported chain/method | Reject to dApp + Activity                |
| User reject              | SDK USER_REJECTED                        |
| Pair / approve timeouts  | Bounded (25s / 20s / 5 min request wait) |
| Relay unavailable        | Pairing error message                    |

---

## 17. Security audit

| Control                       | Status                                  |
| ----------------------------- | --------------------------------------- |
| Private keys leave device     | **NO**                                  |
| Reown Secret in mobile        | **NO** (not created)                    |
| `.env` gitignored             | **YES**                                 |
| Sensitive logs                | Project ID / keys / mnemonic not logged |
| Auto-approve                  | **NO**                                  |
| WC broadcast bypass           | **NO**                                  |
| Session permission validation | Supported methods/chains only           |
| dApp metadata                 | Treated as untrusted                    |

---

## 18. Testing

| Check                                        | Result                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `flutter analyze lib test`                   | **PASS** (no issues)                                                          |
| `flutter test`                               | **PASS** (121 tests)                                                          |
| New `reown_walletconnect_security_test.dart` | Chain catalog, parser, eth_sign reject, broadcast kill switch, preview safety |
| Alchemy regression                           | Not redesigned; kill switches still asserted in beta tests                    |
| Mocks ≠ live Reown proof                     | Explicit in gates below                                                       |

---

## 19. Android Alpha APK

| Item                | Value                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Path                | `D:\auvora-build\dist\reown-alpha\auvora-wallet-reown-alpha.apk`                                       |
| Size                | **88,303,195 bytes** (~84.2 MB)                                                                        |
| SHA-256             | `584d1ffc54a0eaeefcbbb3c5a3097d5f474936eba2a58a5ebfe609899ea13a37`                                     |
| Version             | `1.0.0-alpha.1+5`                                                                                      |
| Signing             | Release keystore if `android/key.properties` present; otherwise debug signing (per `build.gradle.kts`) |
| dart-define         | `WC_PROJECT_ID` injected from root `.env` (value not printed)                                          |
| Alchemy dart-define | **NOT injected**                                                                                       |
| Build script        | `scripts/build-reown-alpha-apk.ps1`                                                                    |
| TEMP / GRADLE       | `D:\auvora-build\temp`, `D:\auvora-build\gradle-home`                                                  |
| Kotlin incremental  | Disabled (`kotlin.incremental=false`) to avoid C:/D: cache bug                                         |

---

## 20. FINAL GATES

| Gate                        | Status                                                                           |
| --------------------------- | -------------------------------------------------------------------------------- |
| REOWN PROJECT CONFIGURED    | **YES**                                                                          |
| REOWN SDK INITIALIZED LIVE  | **YES** (code path; runtime on device when Project ID present)                   |
| REAL REOWN RELAY CONNECTION | **DEVICE VERIFICATION REQUIRED**                                                 |
| PAIRING                     | **DEVICE VERIFICATION REQUIRED**                                                 |
| SESSION APPROVAL            | **DEVICE VERIFICATION REQUIRED** (UI+SDK wired; needs physical/emulator dApp)    |
| SESSION PERSISTENCE         | **NOT VERIFIED** (unit/local persistence covered; live SDK restore needs device) |
| DISCONNECT                  | **NOT VERIFIED** (code path present; needs device)                               |
| EVM REQUEST PARSING         | **VERIFIED** (unit tests)                                                        |
| LOCAL SIGNING SECURITY      | **VERIFIED** (architecture + tests; no key exfiltration)                         |
| REOWN DASHBOARD ACTIVITY    | **DEVICE VERIFICATION REQUIRED**                                                 |
| PRIVATE KEYS LEAVE DEVICE   | **NO**                                                                           |
| LIVE TRANSACTION BROADCAST  | **NO** (`liveBroadcastEnabled=false`)                                            |
| FLUTTER ANALYZE             | **PASS**                                                                         |
| TESTS                       | **PASS**                                                                         |
| ANDROID APK                 | **PASS**                                                                         |

---

## Key files changed

- `apps/mobile/pubspec.yaml` — `reown_walletkit`, `web3dart`, `eth_sig_util`
- `apps/mobile/lib/connections/reown_wallet_connect_provider.dart` — live WalletKit adapter
- `apps/mobile/lib/connections/wallet_connect_bootstrap.dart` — live vs preview factory
- `apps/mobile/lib/connections/wallet_connect_provider.dart` — port + preview updates
- `apps/mobile/lib/connections/connections_controller.dart` — live pairing/requests/sign/tx
- `apps/mobile/lib/connections/wc_chain_catalog.dart`, `wc_request_parser.dart`, `evm_local_signer.dart`
- `apps/mobile/lib/connections/models.dart` — WC correlation fields
- `apps/mobile/lib/crypto/hd_derivation.dart` — `deriveEvmPrivateKey`
- `apps/mobile/lib/main.dart` — bootstrap + account binder
- UI: connect / permission / approval / signature / more tab
- `apps/mobile/android/gradle.properties` — kotlin incremental off
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — already had `wc:` / `auvora://wc`
- `scripts/build-reown-alpha-apk.ps1`
- `apps/mobile/test/reown_walletconnect_security_test.dart`

---

## Confirmations

- `liveBroadcastEnabled=false` — unchanged
- `allowFundingAddresses=false` — unchanged
- No secrets committed or printed
- No git commit / push performed
- Package: **reown_walletkit 1.3.8**
