# Auvora Wallet — API & Integrations Guide

**Audience:** Platform / mobile ops preparing Closed Beta builds  
**App:** `apps/mobile` (Flutter) · Companion: `apps/web` · Edge: `services/gateway`  
**Secret rule:** Never commit API keys, DSNs, or private credentials. Use CI secrets and `--dart-define` / env injection only.

---

## 1. Architecture (mobile Alpha)

```
Mobile UI
  ├─ PriceService ──► CoinGecko → CoinCap → seeded offline
  ├─ NetworkManager ──► RpcEndpoints (public / Alchemy / overrides) + tip probes
  ├─ PreviewBlockchainAdapter ──► balances/history preview (broadcast kill-switched)
  ├─ QuoteEngine ──► Auvora preview + gated MoonPay / Ramp / Transak
  └─ PreviewWalletConnectProvider ──► local pairing; WC_PROJECT_ID ready for Reown SDK
```

Live chain **broadcast** stays off until `ReleaseConfig.liveBroadcastEnabled = true` after security sign-off.  
RPC health probes and market prices can be live without enabling broadcast.

Canonical config surfaces:

| Surface                   | Path                                               |
| ------------------------- | -------------------------------------------------- |
| Kill switches / marketing | `apps/mobile/lib/release/release_config.dart`      |
| Secrets & partner keys    | `apps/mobile/lib/release/integration_config.dart`  |
| RPC pools                 | `apps/mobile/lib/wallet_engine/rpc_endpoints.dart` |
| On-ramp widgets           | `apps/mobile/lib/engine/onramp_config.dart`        |
| Env template              | `apps/mobile/.env.example`                         |

---

## 2. API matrix

| Service                   | Purpose                  | Status                       | Credential                         | Free tier?                    | How to obtain                    | Env / dart-define                                         |
| ------------------------- | ------------------------ | ---------------------------- | ---------------------------------- | ----------------------------- | -------------------------------- | --------------------------------------------------------- |
| **CoinGecko**             | USD quotes + charts      | **Wired / live** (failover)  | Optional Demo/Pro key              | Yes (anonymous, rate-limited) | https://www.coingecko.com/en/api | `COINGECKO_API_KEY`                                       |
| **CoinCap**               | Quote failover + history | **Wired / live**             | Optional Bearer                    | Yes (public)                  | https://coincap.io/api-docs      | `COINCAP_API_KEY`                                         |
| **Seeded prices**         | Offline last-resort      | **Wired**                    | None                               | N/A                           | Built-in                         | —                                                         |
| **Public EVM RPCs**       | Tip health / future live | **Wired probes**             | None                               | Yes (rate-limited)            | publicnode, Cloudflare, Ankr     | `ETH_RPC_URL`, `ETH_RPC_URL_BACKUP`, `POLYGON_*`, `BSC_*` |
| **Public Solana RPC**     | Tip health / future live | **Wired probes**             | None                               | Yes (rate-limited)            | Solana public + publicnode       | `SOL_RPC_URL`, `SOL_RPC_URL_BACKUP`                       |
| **Mempool / Blockstream** | BTC tip health           | **Wired probes**             | None                               | Yes                           | mempool.space / blockstream.info | `BTC_RPC_URL`, `BTC_RPC_URL_BACKUP`                       |
| **TronGrid / publicnode** | TRON tip health          | **Wired probes**             | None (TronGrid key optional later) | Yes                           | https://www.trongrid.io          | `TRON_RPC_URL`, `TRON_RPC_URL_BACKUP`                     |
| **Alchemy**               | Preferred RPC when keyed | **Config-ready**             | Paid/free trial key                | Limited free                  | https://dashboard.alchemy.com    | `ALCHEMY_API_KEY`                                         |
| **Infura / Ankr keyed**   | Alternate RPC            | Use URL overrides            | Vendor key                         | Varies                        | Vendor dashboards                | `*_RPC_URL` overrides                                     |
| **MoonPay**               | Fiat on-ramp             | **Gated** · widget URL ready | Publishable key + merchant         | Sandbox after signup          | https://www.moonpay.com/partners | `MOONPAY_API_KEY` + `ONRAMP_PARTNER_CHECKOUT_ENABLED`     |
| **Ramp**                  | Fiat on-ramp             | **Gated** · widget URL ready | Host API key + merchant            | Sandbox after signup          | https://ramp.network             | `RAMP_API_KEY` + `ONRAMP_PARTNER_CHECKOUT_ENABLED`        |
| **Transak**               | Fiat on-ramp             | **Gated** · widget URL ready | API key + merchant                 | Sandbox after signup          | https://transak.com              | `TRANSAK_API_KEY` + `ONRAMP_PARTNER_CHECKOUT_ENABLED`     |
| **Stripe**                | Card rails (backend)     | **Not in mobile Alpha**      | Secret + publishable               | Paid                          | https://stripe.com               | Backend only — never in APK                               |
| **WalletConnect / Reown** | dApp pairing relay       | **Preview** · projectId hook | Cloud project ID                   | Free project                  | https://cloud.reown.com          | `WC_PROJECT_ID`                                           |
| **Sentry**                | Crash reporting          | **Hook only** (no SDK)       | DSN                                | Free tier                     | https://sentry.io                | `SENTRY_DSN` + `SENTRY_ENABLED`                           |
| **Firebase / FCM**        | Push                     | **Not wired**                | Firebase project                   | Spark/free                    | Firebase console                 | Deferred — in-app inbox only                              |
| **Analytics SDK**         | Product analytics        | **Disabled honest**          | Vendor key                         | Varies                        | —                                | Preference stored; no SDK                                 |
| **Gateway services**      | Backend mesh             | Separate from APK            | See monorepo `.env*`               | Local/dev                     | `services/gateway`               | `AUTH_SERVICE_URL`, …                                     |

---

## 3. Flutter `--dart-define` cookbook

Build example (secrets from CI — never paste into git):

```bash
flutter build apk --release --target-platform android-arm64 \
  --dart-define=COINGECKO_API_KEY=CG-xxxx \
  --dart-define=COINCAP_API_KEY= \
  --dart-define=WC_PROJECT_ID=your_reown_project_id \
  --dart-define=ALCHEMY_API_KEY= \
  --dart-define=ETH_RPC_URL= \
  --dart-define=MOONPAY_API_KEY= \
  --dart-define=RAMP_API_KEY= \
  --dart-define=TRANSAK_API_KEY= \
  --dart-define=ONRAMP_PARTNER_CHECKOUT_ENABLED=false \
  --dart-define=RPC_HEALTH_PROBE_ENABLED=true \
  --dart-define=SENTRY_DSN= \
  --dart-define=SENTRY_ENABLED=false
```

Empty strings are fine — public market + public RPC paths still work.

### Flag reference

| Define                            | Default | Notes                                                         |
| --------------------------------- | ------- | ------------------------------------------------------------- |
| `COINGECKO_API_KEY`               | `''`    | Demo keys (`CG-…`) use `x-cg-demo-api-key`; others Pro header |
| `COINCAP_API_KEY`                 | `''`    | Optional `Authorization: Bearer`                              |
| `WC_PROJECT_ID`                   | `''`    | Required before linking Reown SDK                             |
| `ALCHEMY_API_KEY`                 | `''`    | Prefers Alchemy URLs in `RpcEndpoints` when set               |
| `ETH_RPC_URL` / `_BACKUP`         | `''`    | Override public Ethereum pool                                 |
| `POLYGON_RPC_URL` / `_BACKUP`     | `''`    | Override Polygon                                              |
| `BSC_RPC_URL` / `_BACKUP`         | `''`    | Override BNB Smart Chain                                      |
| `SOL_RPC_URL` / `_BACKUP`         | `''`    | Override Solana                                               |
| `BTC_RPC_URL` / `_BACKUP`         | `''`    | Override BTC tip REST                                         |
| `TRON_RPC_URL` / `_BACKUP`        | `''`    | Override Tron                                                 |
| `MOONPAY_API_KEY`                 | `''`    | Publishable only                                              |
| `RAMP_API_KEY`                    | `''`    | Host API / publishable                                        |
| `TRANSAK_API_KEY`                 | `''`    | Publishable / staging                                         |
| `ONRAMP_PARTNER_CHECKOUT_ENABLED` | `false` | Opens partner hosted widget when key present                  |
| `RPC_HEALTH_PROBE_ENABLED`        | `true`  | Tip probes for Diagnostics                                    |
| `SENTRY_DSN`                      | `''`    | Hook only until Flutter Sentry package is linked              |
| `SENTRY_ENABLED`                  | `false` | Dual gate with DSN                                            |

---

## 4. Market data

1. `PriceService` tries **CoinGecko → CoinCap → seeded**.
2. User-Agent: `AuvoraWallet/1.0-alpha (Flutter; Android)`.
3. Without keys: public endpoints work until rate-limited; UI marks quotes **stale** on seed failover.
4. With Demo CoinGecko key: higher anonymous limits — recommended for Closed Beta CI builds.

---

## 5. RPC & live broadcast

| Concern             | Alpha behavior                                 |
| ------------------- | ---------------------------------------------- |
| Tip / health probes | Real public (or Alchemy/override) URLs         |
| Balances / history  | Preview adapters (deterministic)               |
| Broadcast           | **Off** — `ReleaseConfig.liveBroadcastEnabled` |
| Funding receive     | **Locked** — `allowFundingAddresses`           |

To go live later (checklist, not a toggle-only ship):

1. Security audit of signing + adapters.
2. Set Alchemy (or URL overrides) via CI secrets.
3. Flip `liveBroadcastEnabled` + `allowFundingAddresses` after sign-off.
4. Prefer backend Blockchain Service for production (see `docs/BLOCKCHAIN_PROVIDER_GUIDE.md`) so keys stay off-device when possible.

---

## 6. Buy / on-ramp partner onboarding

### Why Alpha gates partners

Full MoonPay / Ramp / Transak require:

- Company merchant agreement + KYC program
- Publishable **and** secret keys (secret stays server-side)
- Redirect / deep-link allow-lists
- Sandbox vs production widget domains
- Compliance review for supported countries / assets

### Closed Beta enablement (hosted widget)

1. Complete partner signup (links in matrix).
2. Create **sandbox** application; copy **publishable** key only into CI.
3. Register redirect / return URLs:
   - Android: `auvora://auth` (already in `AndroidManifest.xml`)
   - iOS: `auvora` URL scheme (already in `Info.plist`)
   - HTTPS: `https://wallet.auvora.app/connect` (when Digital Asset Links are live)
4. Build with:

```bash
--dart-define=MOONPAY_API_KEY=pk_test_... \
--dart-define=ONRAMP_PARTNER_CHECKOUT_ENABLED=true
```

5. Buy flow marks the partner **External checkout** and opens the hosted widget.  
   Embedded SDK checkout is a separate engineering milestone.

In-app copy uses **Partner onboarding** when keys are absent — not a fake “Coming soon” that looks selectable.

---

## 7. WalletConnect / deep links

| Platform | Schemes / hosts                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Android  | `auvora://wc`, `auvora://sign`, `auvora://auth`, `auvora://tx`, `wc:`, HTTPS `/wc` + `/connect` on `wallet.auvora.app` |
| iOS      | URL schemes `auvora`, `wc`; `FlutterDeepLinkingEnabled`                                                                |

Obtain Project ID:

1. https://cloud.reown.com (WalletConnect Cloud)
2. Create project → copy Project ID
3. `--dart-define=WC_PROJECT_ID=...`

Alpha still uses `PreviewWalletConnectProvider` (`isLiveRelay == false`). The project ID is carried so linking `reown_walletkit` / AppKit is a config + dependency step, not a rewrite of Permission Center.

---

## 8. Observability

| Signal                  | Status                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| Client diagnostics JSON | Live (no secrets)                                                   |
| Analytics SDK           | Honest disabled                                                     |
| Sentry                  | DSN + `SENTRY_ENABLED` hooks only — add `sentry_flutter` when ready |
| Push (FCM)              | OS permission prepared; delivery not wired                          |
| Gateway OTEL            | `OTEL_ENABLED` on services (separate from mobile)                   |

---

## 9. Android / iOS setup checklist

- [ ] `INTERNET`, camera, biometrics, notifications permissions (Android manifest)
- [ ] Network security config HTTPS-only
- [ ] Deep link intent-filters match WC / Auvora schemes
- [ ] iOS `CFBundleURLSchemes` includes `auvora` + `wc`
- [ ] iOS Face ID / camera usage strings present
- [ ] Release signing via company keystore (never commit)
- [ ] CI injects dart-defines from secret store

---

## 10. Closed Beta enablement checklist

- [ ] CoinGecko Demo key in CI (optional but recommended)
- [ ] Confirm Diagnostics → Endpoints show public/Alchemy labels (not `*.preview` placeholders)
- [ ] Confirm prices refresh online; stale banner only on seed failover
- [ ] Create Reown project; inject `WC_PROJECT_ID`
- [ ] Partner merchant applications started (MoonPay / Ramp / Transak)
- [ ] Legal pages live at `wallet.auvora.app/legal/*`
- [ ] Sentry project created; keep `SENTRY_ENABLED=false` until SDK package lands
- [ ] Keep `liveBroadcastEnabled` / funding locked until audit
- [ ] Distribute APK via internal track only

---

## 11. Security notes

1. **Never** commit `.env`, keystores, or real `dart-define` values.
2. Prefer **publishable** keys in the client; secrets stay on gateway / payments service.
3. Diagnostics export redacts Alchemy path segments (`/v2/••••`).
4. `IntegrationConfig.readinessSummary()` exposes booleans only.
5. Public RPCs are best-effort — production should migrate to Alchemy + backend proxy.

---

## 12. Related docs

- [`ALPHA_RECOVERY_SPRINT_REPORT.md`](./ALPHA_RECOVERY_SPRINT_REPORT.md) — price failover, activity persist
- [`API_INTEGRATIONS_SPRINT_REPORT.md`](./API_INTEGRATIONS_SPRINT_REPORT.md) — this sprint’s evidence
- [`BLOCKCHAIN_PROVIDER_GUIDE.md`](./BLOCKCHAIN_PROVIDER_GUIDE.md) — backend Alchemy wiring
- [`DEVELOPER_HANDOFF_ALPHA_1.0.md`](./DEVELOPER_HANDOFF_ALPHA_1.0.md)
