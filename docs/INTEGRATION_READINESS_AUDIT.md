# Integration Readiness Audit

**Date:** 2026-07-31  
**Scope:** Read-only verification from codebase + configuration (no secrets printed)  
**Surfaces inspected:** `apps/mobile`, `apps/web`, `services/*`, `packages`, `.env*.example`, dart-defines, `release_config.dart`, `integration_config.dart`, AndroidManifest, Info.plist, `pubspec.yaml`, `package.json`, related docs

**Alpha kill switches (unchanged):**

| Switch                                     | Value              | Effect                              |
| ------------------------------------------ | ------------------ | ----------------------------------- |
| `ReleaseConfig.liveBroadcastEnabled`       | `false`            | No live chain broadcast from mobile |
| `ReleaseConfig.allowFundingAddresses`      | `false`            | Receive QR/copy/share locked        |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED`          | default `false`    | MoonPay / Ramp / Transak soft-gated |
| `PreviewWalletConnectProvider.isLiveRelay` | `false`            | No live WC relay                    |
| Analytics / Crash toggles                  | disabled / unwired | No Firebase / analytics egress      |

Cross-check sources: [`API_AND_INTEGRATIONS_GUIDE.md`](./API_AND_INTEGRATIONS_GUIDE.md), [`API_INTEGRATIONS_SPRINT_REPORT.md`](./API_INTEGRATIONS_SPRINT_REPORT.md), [`ALPHA_RECOVERY_SPRINT_REPORT.md`](./ALPHA_RECOVERY_SPRINT_REPORT.md).

---

## Production readiness checklist

| Integration              | Pass/Fail | One-line reason                                                                                                     |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| Alchemy                  | **Fail**  | Config-ready (mobile + backend); no committed credentials; mobile uses probes only while broadcast is kill-switched |
| CoinGecko                | **Pass**  | Live HTTP quotes wired (mobile + optional market-data service); works without key; Demo/Pro key optional            |
| WalletConnect            | **Fail**  | Preview/local pairing only; no Reown/WalletConnect SDK; `isLiveRelay == false`                                      |
| Firebase Cloud Messaging | **Fail**  | Not present — no packages, no Firebase config files, in-app inbox only                                              |
| Firebase Analytics       | **Fail**  | Not present — Privacy toggle hard-disabled; no analytics SDK                                                        |
| Firebase Crashlytics     | **Fail**  | Not present — Sentry dart-define hooks only; no Firebase/Sentry package                                             |
| MoonPay                  | **Fail**  | Soft-gated; empty keys; production widget URL builder only; no SDK; merchant required                               |
| Ramp                     | **Fail**  | Soft-gated; empty keys; production widget URL builder only; no SDK; merchant required                               |
| Transak                  | **Fail**  | Soft-gated; empty keys; production widget URL builder only; no SDK; merchant required                               |

**Score: 1 Pass / 8 Fail**

---

## 1. Alchemy

### 1. Current implementation status

**Gated / Live-capable (when keyed)** — Mobile: RPC URL preference + tip health probes when `ALCHEMY_API_KEY` is compiled in; live broadcast remains off. Backend blockchain service: full Alchemy provider stack when env credentials exist and `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`.

### 2. SDK/API integrated?

**YES (HTTP RPC, no Alchemy SDK package)**

| Evidence           | Path                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile URL builder | `apps/mobile/lib/wallet_engine/rpc_endpoints.dart` (`_alchemyUrls`)                                                                                                                     |
| Config surface     | `apps/mobile/lib/release/integration_config.dart` (`alchemyApiKey`)                                                                                                                     |
| Backend providers  | `services/blockchain/src/infrastructure/providers/alchemy/*` (`AlchemyEvmProvider`, `AlchemySolanaProvider`, `AlchemyTronProvider`, `AlchemyBitcoinProvider`, `createAlchemyProviders`) |
| Env schema         | `services/blockchain/src/config/env.schema.ts`                                                                                                                                          |
| Web                | No Alchemy client SDK; `apps/web/next.config.ts` allows `**.alchemy.com` image host only                                                                                                |

No `alchemy-sdk` / `@alch/*/sdk` in any `package.json` or `pubspec.yaml`.

### 3. API credentials configured?

**NO (example-only / empty)**

- Mobile expects `--dart-define=ALCHEMY_API_KEY` (default `''`) — see `apps/mobile/.env.example`
- Backend expects `ALCHEMY_API_KEY` and/or `ALCHEMY_*_RPC_URL` — see root `.env.example`, `.env.production.example` (placeholders only)
- Repo templates contain empty / `<secret>` placeholders; no real keys in tree (verified by template inspection)

### 4. Sandbox mode working?

**N/A (mainnet RPC hosts)** — Code builds `*-mainnet.g.alchemy.com` URLs. No Alchemy Sepolia/devnet toggle found in mobile `RpcEndpoints` or default backend hosts.

### 5. Production mode configured?

**PARTIAL** — URL construction targets mainnet; credentials must be injected at deploy/build time. Mobile production chain ops still blocked by `liveBroadcastEnabled = false`.

### 6. Missing environment variables

| Name                                                                               | Surface                                 |
| ---------------------------------------------------------------------------------- | --------------------------------------- |
| `ALCHEMY_API_KEY`                                                                  | Mobile dart-define + blockchain service |
| `ALCHEMY_ETHEREUM_RPC_URL`                                                         | Backend optional override               |
| `ALCHEMY_BSC_RPC_URL`                                                              | Backend optional                        |
| `ALCHEMY_SOLANA_RPC_URL`                                                           | Backend optional                        |
| `ALCHEMY_TRON_RPC_URL`                                                             | Backend optional                        |
| `ALCHEMY_BITCOIN_RPC_URL`                                                          | Backend optional                        |
| `ALCHEMY_RPC_TIMEOUT_MS`                                                           | Backend (has default)                   |
| `ALCHEMY_REQUIRED`                                                                 | Backend optional fail-boot              |
| `BLOCKCHAIN_PRIMARY_PROVIDER`                                                      | Backend (`alchemy` \| `simulator`)      |
| Mobile optional: `ETH_RPC_URL`, `POLYGON_RPC_URL`, `BSC_RPC_URL`, `SOL_RPC_URL`, … | Overrides without Alchemy               |

### 7. Missing accounts / business approvals

- Alchemy dashboard app with networks enabled (ETH, Polygon, BSC, Solana; BTC/TRON if used)
- Production quota / billing plan for expected RPS
- Prefer backend-proxied RPCs so keys stay off-device (per guide)

### 8. Remaining implementation work

- Inject CI secrets; verify Diagnostics tip probes show Alchemy-labeled endpoints
- For true mobile live tx: unlock `liveBroadcastEnabled` after adapter audit; prefer gateway blockchain service
- Backend: set `ALCHEMY_REQUIRED` appropriately for production boot
- Optional: sepolia/devnet sandbox URL maps for staging

### 9. Exact steps to production-ready

1. Create Alchemy app; enable required networks; copy API key into secrets manager (never git).
2. Backend: set `BLOCKCHAIN_PRIMARY_PROVIDER=alchemy`, `ALCHEMY_API_KEY=…`, optional per-chain URLs; deploy blockchain service; run gated live health tests (`ALCHEMY_LIVE_TEST=true`).
3. Mobile Closed Beta: `--dart-define=ALCHEMY_API_KEY=…` for preferred tip probes (optional if public RPCs suffice).
4. Keep broadcast kill switch until signing/adapters audited; then flip `liveBroadcastEnabled` + funding gates per security sign-off.
5. Confirm Diagnostics redacts `/v2/••••` and readiness shows `alchemyKey: true` without leaking the key.

---

## 2. CoinGecko

### 1. Current implementation status

**Live-capable** — Mobile `PriceService` tries CoinGecko → CoinCap → seeded offline. `ReleaseConfig.liveMarketPricesEnabled = true`. Backend `services/market-data` has `CoinGeckoMarketProvider` (primary when simulator off).

### 2. SDK/API integrated?

**YES (REST via `http`, no official SDK package)**

| Evidence        | Path                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| Mobile provider | `apps/mobile/lib/wallet_engine/coingecko_market_data_provider.dart`       |
| Orchestration   | `apps/mobile/lib/wallet_engine/price_service.dart`                        |
| Failover        | `coincap_market_data_provider.dart`, `seeded_market_data_provider.dart`   |
| Backend         | `services/market-data/src/infrastructure/providers/coingecko.provider.ts` |
| Config          | `IntegrationConfig.coinGeckoApiKey` ← `COINGECKO_API_KEY`                 |

Endpoint: `https://api.coingecko.com/api/v3/simple/price` (+ market_chart). Headers: `x-cg-demo-api-key` if key starts with `CG-`, else `x-cg-pro-api-key`.

### 3. API credentials configured?

**PARTIAL** — Optional; empty default works for anonymous public API. Templates list `COINGECKO_API_KEY=` (example-only). No committed secret found.

### 4. Sandbox mode working?

**N/A** — Public/Demo/Pro API; no separate sandbox environment in code. Anonymous = rate-limited production API.

### 5. Production mode configured?

**YES (with caveat)** — Hits production CoinGecko API. For sustained Closed Beta/prod traffic, Demo or Pro key is recommended to avoid 429 → CoinCap/seed failover.

### 6. Missing environment variables

| Name                                     | Required?                                    |
| ---------------------------------------- | -------------------------------------------- |
| `COINGECKO_API_KEY`                      | Optional (recommended for Beta)              |
| `COINCAP_API_KEY`                        | Optional failover Bearer                     |
| Backend: `COINGECKO_BASE_URL`            | Optional (default public API)                |
| Backend: `MARKET_DATA_SIMULATOR_ENABLED` | Must be `false` for live backend market-data |

### 7. Missing accounts / business approvals

- Optional CoinGecko Demo or Pro account for higher limits
- No merchant/KYC required for price quotes

### 8. Remaining implementation work

- Add Demo key to CI dart-defines for Closed Beta builds
- Monitor Diagnostics / stale-price UI when 429 occurs
- Align backend market-data with mobile if gateway-fed quotes are desired later

### 9. Exact steps to production-ready

1. (Recommended) Create CoinGecko Demo/Pro key; inject `COINGECKO_API_KEY` via CI `--dart-define`.
2. Optionally set `COINCAP_API_KEY` for failover headroom.
3. Verify online refresh + stale banner only on seed failover.
4. Backend (if used): `MARKET_DATA_SIMULATOR_ENABLED=false` + same API key env.

---

## 3. WalletConnect

### 1. Current implementation status

**Stub / Partial (preview)** — `PreviewWalletConnectProvider` stores local proposals/sessions; deep links parse `wc:` / `auvora://wc`; **no live relay**. Web uses gateway WalletConnect-shaped simulator APIs, not a live Reown client.

### 2. SDK/API integrated?

**NO (port + preview only)**

| Evidence                | Path                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Preview provider        | `apps/mobile/lib/connections/wallet_connect_provider.dart` (`isLiveRelay => false`) |
| Controller default      | `connections_controller.dart` → `PreviewWalletConnectProvider()`                    |
| Deep links Android      | `AndroidManifest.xml` (`auvora://wc`, `wc:`, HTTPS `/wc`)                           |
| Deep links iOS          | `Info.plist` schemes `auvora`, `wc`                                                 |
| Project ID hook         | `WC_PROJECT_ID` → `IntegrationConfig.wcProjectId`                                   |
| Backend                 | `services/connections` simulator (`CONNECTIONS_SIMULATOR_ENABLED`)                  |
| `pubspec.yaml`          | No `reown_walletkit`, `walletconnect_flutter_v2`, etc.                              |
| `apps/web/package.json` | No `@reown/*` / `@walletconnect/*`                                                  |

### 3. API credentials configured?

**NO** — `WC_PROJECT_ID=` empty in `apps/mobile/.env.example`. Project ID free from Reown Cloud but not injected in repo templates.

### 4. Sandbox mode working?

**YES (local preview only)** — In-app “preview pairing” / simulated sessions. Not Reown Cloud sandbox — no relay traffic.

### 5. Production mode configured?

**NO** — Explicit copy: “relay pending SDK”; web ConnectionApprovalPanel states simulated material.

### 6. Missing environment variables

| Name                                        | Notes                                         |
| ------------------------------------------- | --------------------------------------------- |
| `WC_PROJECT_ID`                             | Required before linking Reown SDK             |
| Backend: `CONNECTIONS_SIMULATOR_ENABLED`    | Must eventually be `false` with live provider |
| Backend: `CONNECTIONS_FIELD_ENCRYPTION_KEY` | Session encryption                            |

### 7. Missing accounts / business approvals

- Reown Cloud project (free tier available)
- Domain / deep-link verification (`wallet.auvora.app` Digital Asset Links — noted deferred in manifest)
- App metadata / redirect allow-lists in Reown dashboard

### 8. Remaining implementation work

- Add `reown_walletkit` (or AppKit) dependency; implement live `WalletConnectProviderPort`
- Wire project ID, relay, session persistence, signing approvals to Permission Center
- Replace web simulator UX with live pairing or document companion as preview-only
- Complete HTTPS App Links / Universal Links hosting

### 9. Exact steps to production-ready

1. Create project at https://cloud.reown.com; copy Project ID.
2. Build with `--dart-define=WC_PROJECT_ID=…`.
3. Add Reown Flutter SDK; implement live provider (`isLiveRelay == true`); keep preview as fallback for tests.
4. Register redirect URIs matching Android/iOS schemes; host Digital Asset Links.
5. Security review of signing approval UI; disable simulator on connections service for prod.
6. End-to-end test: QR from MetaMask/Uniswap → approve → sign message → disconnect.

---

## 4. Firebase Cloud Messaging (FCM)

### 1. Current implementation status

**Not present** — Docs and Privacy/notifications UX: in-app inbox only. Android has `POST_NOTIFICATIONS` permission (OS prep), no FCM delivery.

### 2. SDK/API integrated?

**NO**

- No `firebase_core`, `firebase_messaging` in `pubspec.yaml`
- No `google-services.json` / `GoogleService-Info.plist` in repo
- No Firebase references under `apps/mobile`
- Backend notifications: simulator / HTTP channel ports — not FCM-specific client wiring (`NOTIFICATIONS_CHANNEL_PUSH_ENABLED` exists as a channel flag, not a Firebase SDK)

### 3. API credentials configured?

**NO** — No Firebase env vars in mobile `.env.example`. No Firebase project config files.

### 4. Sandbox mode working?

**N/A**

### 5. Production mode configured?

**NO**

### 6. Missing environment variables

Expected once implemented (not in code today):

- Firebase project / `GoogleService-Info.plist` / `google-services.json` (file-based, not dart-define)
- Typically: server key / FCM v1 service account on notifications service
- Optional future: `FIREBASE_*` or `FCM_*` for backend push gateway

### 7. Missing accounts / business approvals

- Firebase / Google Cloud project
- Apple APNs key + App ID push capability (iOS)
- Privacy policy disclosure for push

### 8. Remaining implementation work

- Add FlutterFire packages; configure Android Gradle Google Services plugin + iOS Firebase
- Token registration, topic/device targeting, notification service handlers
- Wire notifications service push channel to FCM HTTP v1
- Consent UX beyond current disabled analytics pattern

### 9. Exact steps to production-ready

1. Create Firebase project; enable Cloud Messaging; download platform config files (keep out of public git or use secure CI).
2. Add `firebase_core` + `firebase_messaging`; initialize on app start after consent policy.
3. Implement token sync to backend; send test push from Firebase console.
4. Configure APNs for iOS; request notification permission with honest copy.
5. Production: FCM v1 service account on notifications service; disable simulator for push channel.

---

## 5. Firebase Analytics

### 1. Current implementation status

**Not present** — Privacy Settings hard-disables Analytics with copy: “no analytics SDK is wired; nothing leaves this device.” Separate monorepo **Analytics Platform** (`services/analytics`, port 3007) is an internal Nest event pipeline — **not** Firebase Analytics.

### 2. SDK/API integrated?

**NO** — No `firebase_analytics` in pubspec; no Firebase Analytics in web `package.json`. Preference storage exists on web (`prefs.analytics`) but is product preference, not Firebase.

### 3. API credentials configured?

**NO**

### 4. Sandbox mode working?

**N/A**

### 5. Production mode configured?

**NO**

### 6. Missing environment variables

None defined for Firebase Analytics. If chosen later: Firebase config files + optional measurement IDs.

### 7. Missing accounts / business approvals

- Firebase project with Analytics
- Privacy/legal review + in-app consent (GDPR/CCPA)

### 8. Remaining implementation work

- Choose vendor (Firebase vs other); add SDK; wire consent toggle
- Or continue honest-disabled + rely on first-party `services/analytics` only for authenticated platform events

### 9. Exact steps to production-ready

1. Product decision: Firebase Analytics vs first-party only.
2. If Firebase: add package, consent-gated collection, disable by default until opt-in.
3. Update Privacy Settings from hard-disabled to consent-controlled.
4. Validate DebugView / production property separation.

---

## 6. Firebase Crashlytics

### 1. Current implementation status

**Not present** — Crash reporting Privacy toggle disabled. Hooks exist for **Sentry** (`SENTRY_DSN`, `SENTRY_ENABLED`), not Firebase Crashlytics. No `sentry_flutter` package linked yet either.

### 2. SDK/API integrated?

**NO** — No `firebase_crashlytics`; no `sentry_flutter` in `pubspec.yaml`.

### 3. API credentials configured?

**NO** — `SENTRY_DSN=` / `SENTRY_ENABLED=false` in mobile `.env.example` (example-only). No Crashlytics keys.

### 4. Sandbox mode working?

**N/A**

### 5. Production mode configured?

**NO**

### 6. Missing environment variables

| Name                 | Notes                                                    |
| -------------------- | -------------------------------------------------------- |
| `SENTRY_DSN`         | Present as hook (not Crashlytics)                        |
| `SENTRY_ENABLED`     | Dual gate; default false                                 |
| Firebase Crashlytics | Not defined — would need Firebase config files if chosen |

### 7. Missing accounts / business approvals

- Either Sentry project **or** Firebase Crashlytics
- Privacy disclosure for crash dumps

### 8. Remaining implementation work

- Prefer completing Sentry path already scaffolded: add `sentry_flutter`, gate on `IntegrationConfig.sentryReady`
- Or pivot to Crashlytics (new Firebase stack — overlaps FCM project setup)

### 9. Exact steps to production-ready

1. Decide Sentry vs Crashlytics (code already leans Sentry).
2. Add SDK package; initialize only when `sentryReady` / Crashlytics enabled + user consent if required.
3. Inject DSN/config via CI; set enable flag true for release tracks.
4. Verify test crash appears in dashboard; keep Alpha builds off until ready.

---

## 7. MoonPay

### 1. Current implementation status

**Gated** — Listed in `FiatProviderCatalog`; `QuoteEngine.compareBuyProviders` marks unavailable unless `partnerCheckoutReady('moonpay')` (= key present **and** `ONRAMP_PARTNER_CHECKOUT_ENABLED=true`). Default Alpha: Auvora preview only. Hosted widget URL builder exists; no embedded SDK.

### 2. SDK/API integrated?

**PARTIAL (URL launch only — no MoonPay SDK)**

| Evidence   | Path                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| Widget URI | `OnRampConfig.widgetUri` → `buy.moonpay.com`                            |
| Soft gate  | `IntegrationConfig.partnerCheckoutReady`                                |
| Buy UI     | `digital_asset_flow.dart` (`launchUrl` external)                        |
| Web        | `apps/web/src/lib/trading/quote-engine.ts` — MoonPay `available: false` |
| Packages   | No MoonPay SDK in pubspec / package.json                                |

### 3. API credentials configured?

**NO** — `MOONPAY_API_KEY=` empty in `.env.example`. Publishable key only intended for client.

### 4. Sandbox mode working?

**NO** — Docs instruct sandbox signup, but code always uses production host `buy.moonpay.com` (not `buy-sandbox.moonpay.com`). No `MOONPAY_ENV` / sandbox flag in `OnRampConfig`.

### 5. Production mode configured?

**PARTIAL** — Production widget domain wired; dual gate defaults off; merchant keys missing; secret keys must stay server-side (not implemented).

### 6. Missing environment variables

| Name                                    | Role                                 |
| --------------------------------------- | ------------------------------------ |
| `MOONPAY_API_KEY`                       | Publishable / pk_test                |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED`       | Must be `true` to open widget        |
| Recommended future: sandbox host toggle | Not in code today                    |
| Server-side secret                      | Not in mobile — payments/gateway TBD |

### 7. Missing accounts / business approvals

- MoonPay partner / merchant agreement
- KYC program, supported countries/assets review
- Redirect URI allow-list (`auvora://auth`, etc.)
- Sandbox then production API keys

### 8. Remaining implementation work

- Merchant onboarding; inject publishable key; enable flag for Beta
- Add sandbox vs production host switch
- Optional: embedded MoonPay SDK; webhook/settlement via backend
- Return deep-link handling after checkout
- Web companion: flip `available` when real rails exist

### 9. Exact steps to production-ready

1. Complete MoonPay merchant signup; create sandbox app; register redirects.
2. Build with `--dart-define=MOONPAY_API_KEY=pk_test_… --dart-define=ONRAMP_PARTNER_CHECKOUT_ENABLED=true`.
3. Add sandbox host support in `OnRampConfig` before testing; then promote to live publishable key + `buy.moonpay.com`.
4. Keep secrets on server; never ship secret key in APK.
5. Compliance sign-off; E2E buy with small fiat in sandbox then production.

---

## 8. Ramp

### 1. Current implementation status

**Gated** — Same soft-gate pattern as MoonPay (`ramp` code in catalog + `RAMP_API_KEY` + `ONRAMP_PARTNER_CHECKOUT_ENABLED`).

### 2. SDK/API integrated?

**PARTIAL (hosted widget URL only)**

- `OnRampConfig` → `app.ramp.network` with `hostApiKey`
- No Ramp SDK in dependencies
- Web quote catalog: Ramp `available: false`

### 3. API credentials configured?

**NO** — `RAMP_API_KEY=` example-empty.

### 4. Sandbox mode working?

**NO / unverified** — Code uses `app.ramp.network` only; no explicit Ramp demo/sandbox host flag in repo.

### 5. Production mode configured?

**PARTIAL** — Production-style host; gates default off; credentials missing.

### 6. Missing environment variables

| Name                              | Role                     |
| --------------------------------- | ------------------------ |
| `RAMP_API_KEY`                    | Host API / publishable   |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED` | Enable external checkout |
| Future: Ramp sandbox URL / env    | Not implemented          |

### 7. Missing accounts / business approvals

- Ramp Network merchant account
- Host API key + secret (secret server-side)
- Redirect / webhook configuration
- Jurisdiction / asset enablement

### 8. Remaining implementation work

- Same class of work as MoonPay: merchant, keys, sandbox toggle, return URLs, optional SDK, backend webhooks

### 9. Exact steps to production-ready

1. Sign up at Ramp; obtain host API key; configure redirects (`auvora://auth`, HTTPS connect).
2. Inject `RAMP_API_KEY` + `ONRAMP_PARTNER_CHECKOUT_ENABLED=true` for gated Beta builds.
3. Confirm widget URL asset codes (`ETH_ETH`, etc.) match enabled Ramp assets.
4. Sandbox test → production keys; keep secret off-device.
5. Align web BuyExperience when live.

---

## 9. Transak

### 1. Current implementation status

**Gated** — Same dual gate (`TRANSAK_API_KEY` + `ONRAMP_PARTNER_CHECKOUT_ENABLED`). Widget host `global.transak.com`.

### 2. SDK/API integrated?

**PARTIAL (hosted widget URL only)**

- `OnRampConfig.widgetUri` case `transak`
- No Transak SDK package
- Web: Transak `available: false`

### 3. API credentials configured?

**NO** — `TRANSAK_API_KEY=` example-empty.

### 4. Sandbox mode working?

**NO** — Production host `global.transak.com` only; Transak staging typically uses `global-stg.transak.com` (not referenced in code).

### 5. Production mode configured?

**PARTIAL** — Production domain in builder; enablement gates off; no merchant keys.

### 6. Missing environment variables

| Name                              | Role                     |
| --------------------------------- | ------------------------ |
| `TRANSAK_API_KEY`                 | Publishable / API key    |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED` | Enable external checkout |
| Future: staging host toggle       | Not implemented          |

### 7. Missing accounts / business approvals

- Transak partner onboarding
- KYC / geo configuration
- Redirect URL allow-list
- Staging then production keys

### 8. Remaining implementation work

- Merchant + keys + staging host switch + return deep links + optional SDK + backend secrets/webhooks

### 9. Exact steps to production-ready

1. Complete Transak partner application; create staging app.
2. Add staging host support; test with staging key + enable flag.
3. Promote to `global.transak.com` + production key.
4. Verify `walletAddress` / `disableWalletAddressForm` once funding addresses unlock.
5. Compliance + E2E checkout; update web availability flags.

---

## Alpha honesty notes (buy / WC / broadcast)

From `quote_engine.dart` + recovery sprint CI5:

- Partners appear in compare UI but `available: false` until checkout-ready.
- Unavailable copy uses **Partner onboarding** messaging (`OnRampConfig.unavailableReason`), not fake selectable live rails.
- Selecting a gated partner without keys cannot open live checkout.
- WalletConnect UI states preview / non-live relay explicitly.
- Alchemy on mobile does **not** imply live balances/broadcast — preview blockchain adapters + kill switches still apply.

---

## Config inventory (no secret values)

| Define / env                             | Mobile    | Backend           | Default in examples |
| ---------------------------------------- | --------- | ----------------- | ------------------- |
| `ALCHEMY_API_KEY`                        | Yes       | Yes               | empty               |
| `COINGECKO_API_KEY`                      | Yes       | Yes (market-data) | empty               |
| `WC_PROJECT_ID`                          | Yes       | —                 | empty               |
| `MOONPAY_API_KEY`                        | Yes       | —                 | empty               |
| `RAMP_API_KEY`                           | Yes       | —                 | empty               |
| `TRANSAK_API_KEY`                        | Yes       | —                 | empty               |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED`        | Yes       | —                 | `false`             |
| Firebase / FCM / Crashlytics / Analytics | —         | —                 | **absent**          |
| `SENTRY_DSN` / `SENTRY_ENABLED`          | Hook only | —                 | empty / false       |

Canonical mobile template: `apps/mobile/.env.example`  
Canonical compile surface: `apps/mobile/lib/release/integration_config.dart`

---

## Document history

| Date       | Author                                  | Note                                      |
| ---------- | --------------------------------------- | ----------------------------------------- |
| 2026-07-31 | Integration readiness audit (read-only) | Codebase-verified; no app source modified |
