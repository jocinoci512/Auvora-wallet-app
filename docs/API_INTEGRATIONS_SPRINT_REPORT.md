# API & Integrations Sprint Report

**Date:** 2026-07-31  
**Goal:** Closed Beta infrastructure readiness — every external dependency inventoried, public paths solid, partner/account gates honest, ops runbook complete.  
**Constraint honored:** No secrets committed; live broadcast remains kill-switched.

---

## Verdict

**API & integration readiness for briefed Closed Beta: READY (config-complete)**

- Market data: CoinGecko → CoinCap → seeded, with User-Agent + optional keys via `IntegrationConfig`.
- RPC: Real public endpoint pools + optional Alchemy/URL overrides; tip health probes (not live broadcast).
- On-ramp: Professional partner-onboarding copy; hosted-widget surface when ops enable keys + `ONRAMP_PARTNER_CHECKOUT_ENABLED`.
- WalletConnect: `WC_PROJECT_ID` hook; deep links already match Android/iOS manifests.
- Observability: Honest disabled analytics; Sentry DSN dual-gate hook without fake SDK.
- Runbook: [`API_AND_INTEGRATIONS_GUIDE.md`](./API_AND_INTEGRATIONS_GUIDE.md) + `apps/mobile/.env.example`.

---

## API matrix (summary)

| Service                        | Status                   | Live without company account?                  |
| ------------------------------ | ------------------------ | ---------------------------------------------- |
| CoinGecko                      | Wired live               | Yes (rate-limited); key recommended            |
| CoinCap                        | Wired live failover      | Yes                                            |
| Seeded prices                  | Wired fallback           | Yes                                            |
| Public RPC tip probes          | Wired                    | Yes                                            |
| Alchemy RPC preference         | Config-ready             | Needs `ALCHEMY_API_KEY`                        |
| MoonPay / Ramp / Transak       | Gated + widget ready     | Needs merchant + publishable key + enable flag |
| WalletConnect / Reown          | Preview + projectId hook | Project ID free; live relay needs SDK          |
| Sentry                         | Hook only                | Needs DSN + SDK package later                  |
| Firebase / FCM / Analytics SDK | Not wired (honest)       | Account + SDK later                            |
| Stripe                         | Backend only             | Never in APK                                   |
| Live broadcast / funding       | Kill-switched            | Security sign-off                              |

Full matrix with signup links and define names: **§2** of the [guide](./API_AND_INTEGRATIONS_GUIDE.md).

---

## What was wired

| Area                              | Change                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `IntegrationConfig`               | Central `--dart-define` surface for all mobile integrations                           |
| `RpcEndpoints` + `RpcHealthProbe` | Public failover lists; Alchemy when keyed; Diagnostics labels                         |
| `NetworkManager`                  | Uses real URL pools; probes tips when enabled                                         |
| Market providers                  | Read keys from `IntegrationConfig`                                                    |
| On-ramp                           | `OnRampConfig` widget URIs + partner onboarding messaging; optional external checkout |
| WalletConnect port                | `projectId` from `WC_PROJECT_ID`                                                      |
| Privacy / Diagnostics             | Sentry readiness + integration boolean summary (no secrets)                           |
| Docs / `.env.example`             | Company-grade enablement runbook                                                      |

Recovery sprint hardening (activity persist, biometrics path, price failover) left intact.

---

## What remains account-gated

1. **MoonPay / Ramp / Transak** — merchant agreements, KYC programs, sandbox→prod keys, redirect allow-lists.
2. **Reown live relay** — add SDK (`reown_walletkit` / AppKit) using compiled `WC_PROJECT_ID`.
3. **Alchemy production quotas** — preferred but optional; public RPCs suffice for tip probes.
4. **Sentry Flutter package** — DSN hook is ready; package not linked (avoids dead weight).
5. **Push / product analytics** — deferred; preferences exist, no egress SDK.
6. **Live broadcast + funding unlock** — intentional Alpha kill switches.

### How to complete

Follow Closed Beta checklist in [`API_AND_INTEGRATIONS_GUIDE.md`](./API_AND_INTEGRATIONS_GUIDE.md) §10.

---

## Files changed (primary)

- `apps/mobile/lib/release/integration_config.dart` _(new)_
- `apps/mobile/lib/release/release_config.dart`
- `apps/mobile/lib/wallet_engine/rpc_endpoints.dart` _(new)_
- `apps/mobile/lib/wallet_engine/rpc_health_probe.dart` _(new)_
- `apps/mobile/lib/wallet_engine/network_manager.dart`
- `apps/mobile/lib/wallet_engine/coingecko_market_data_provider.dart`
- `apps/mobile/lib/wallet_engine/coincap_market_data_provider.dart`
- `apps/mobile/lib/wallet_engine/blockchain_adapter.dart`
- `apps/mobile/lib/engine/onramp_config.dart` _(new)_
- `apps/mobile/lib/engine/quote_engine.dart`
- `apps/mobile/lib/engine/quote_provider_port.dart`
- `apps/mobile/lib/ui/engine/digital_asset_flow.dart`
- `apps/mobile/lib/connections/wallet_connect_provider.dart`
- `apps/mobile/lib/ui/settings/diagnostics_screen.dart`
- `apps/mobile/lib/ui/settings/privacy_settings_screen.dart`
- `apps/mobile/lib/ui/settings/about_screen.dart`
- `apps/mobile/test/integration_config_test.dart` _(new)_
- `apps/mobile/test/reliability_test.dart`
- `apps/mobile/test/quote_engine_test.dart`
- `apps/mobile/test/connections_controller_test.dart`
- `apps/mobile/.env.example` _(new)_
- `docs/API_AND_INTEGRATIONS_GUIDE.md` _(new)_
- `docs/API_INTEGRATIONS_SPRINT_REPORT.md` _(this file)_
- `docs/ALPHA_RECOVERY_SPRINT_REPORT.md` _(pointer)_
- `docs/DEVELOPER_HANDOFF_ALPHA_1.0.md` _(pointer)_
- `apps/web/src/lib/release/config.ts` _(guide pointer)_

---

## Verification evidence

| Check               | Result                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `flutter analyze`   | **No issues found**                                                                                           |
| Full `flutter test` | **107 passed**                                                                                                |
| APK                 | `D:\auvora-build\dist\alpha-1.0.0-api-integrations\auvora-wallet-1.0.0-alpha-api-integrations.apk` (~41.0 MB) |
| SHA-256             | `65E44590C18B526B80C62F1CB1179634846A20026CF3CCC4EF7ABDB04BD2D4B9`                                            |
| Checksums           | `D:\auvora-build\dist\alpha-1.0.0-api-integrations\SHA256SUMS.txt`                                            |
| Gradle home         | `D:\auvora-build\gradle-home`                                                                                 |

---

## Live vs needs company accounts

| Live now (public / no paid account) | Needs company account / CI secret              |
| ----------------------------------- | ---------------------------------------------- |
| CoinGecko anonymous quotes          | CoinGecko Demo/Pro key (recommended)           |
| CoinCap public quotes               | CoinCap key (optional)                         |
| Public RPC tip probes               | Alchemy key (preferred for Closed Beta+)       |
| Preview balances / WC pairing       | Reown project ID + SDK for live relay          |
| Auvora buy preview                  | MoonPay / Ramp / Transak merchant + keys       |
| Diagnostics readiness flags         | Sentry project + Flutter SDK                   |
| Deep link scheme registration       | Hosted Digital Asset Links for HTTPS App Links |
