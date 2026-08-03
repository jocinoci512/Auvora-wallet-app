# Auvora — One Account + Live Web Wallet Ecosystem Report

**Date:** 2026-08-02  
**Workspace:** `D:\auvora-wallet` only  
**Commit / push:** **NOT performed** (per instructions)  
**Related:**

- `docs/AUVORA_PREMIUM_WEB_ECOSYSTEM_RECONSTRUCTION_REPORT.md` (prior — do not redesign)
- `docs/REOWN_WALLETCONNECT_PRODUCTION_INTEGRATION_REPORT.md`
- `docs/ALCHEMY_LIVE_PRODUCTION_INTEGRATION_REPORT.md`
- `docs/AUVORA_ENCRYPTED_CROSS_DEVICE_SECURITY_DESIGN.md` (**design only**)

---

## Executive summary

This sprint established a **production-oriented foundation** for one Auvora account across web + mobile: real auth session plumbing (device registration, CSRF, verify/reset), public-address registration + EVM ownership challenge, server-side portfolio/activity paths, Security/Devices wired to live account APIs, and Reown web “Connect Auvora Mobile” pairing foundation. Encrypted seed sync is **intentionally design-only**. Live broadcast remains **OFF**. NFT remains **ABSENT**.

Honest status: coherent **BETA foundation**, with several gates **PARTIAL** or **DEVICE VERIFICATION REQUIRED** rather than fake PASS.

---

## Security invariants (MUST)

| Invariant                                          | Status                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| PLAINTEXT PRIVATE KEYS/SEEDS/MNEMONICS SERVER-SIDE | **NO** — schema has no key/mnemonic columns; APIs reject mnemonic-shaped payloads |
| PRIVATE KEYS THROUGH REOWN                         | **NO** — unchanged; mobile signs locally                                          |
| ALCHEMY PRIVILEGED KEY IN BROWSER                  | **NO** — balances via server blockchain APIs only                                 |
| REOWN SECRET IN BROWSER/APK                        | **NO** — public Project ID only (`NEXT_PUBLIC_WC_PROJECT_ID` / dart-define)       |
| NFT                                                | **ABSENT** (routes still redirect; no product surface added)                      |
| LIVE TRANSACTION BROADCAST                         | **OFF** (`liveBroadcastEnabled=false`; WC cannot bypass)                          |

---

## Why WEB AUTH was PARTIAL (root causes fixed)

| Gap                                                      | Fix                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Login omitted required `deviceFingerprint`               | Web generates stable `auvora_device_id_v1` + sends fingerprint/name/platform                             |
| CSRF header never sent on mutating calls                 | SDK + `settingsFetch` send `x-csrf-token` from cookie/session                                            |
| Password UI minLength 10 vs policy 12                    | UI + copy aligned to 12 + complexity hint                                                                |
| No forgot / reset / verify pages                         | Added `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` (+ `/verify-email` redirect) |
| Access token only in sessionStorage without refresh path | Refresh + CSRF restore on `loadMe` / `refreshSession`                                                    |
| Email verification blocked Alpha login                   | `AUTH_ALLOW_UNVERIFIED_LOGIN` non-prod only (forced false in production)                                 |

**WEB AUTH gate:** **BETA / PASS for foundation** (end-to-end against live auth service still needs environment with DB/Redis/mail — mark **DEVICE/ENV VERIFICATION** for full production login).

---

## Canonical identity model (reuse, no duplicate auth)

| Concept                | Implementation                                                                |
| ---------------------- | ----------------------------------------------------------------------------- |
| User                   | Prisma `User` (identity, prefs fields, MFA flags)                             |
| Device                 | `Device` + `platform`, `appVersion` (migration `20260802210000_…`)            |
| Session / Refresh      | `Session`, `RefreshToken` (httpOnly refresh cookie)                           |
| Wallet / WalletAccount | Existing `Wallet` + preferences.accounts metadata (public)                    |
| PublicAddress          | `WatchAddress` (+ `linkMode`, `ownershipVerifiedAt`)                          |
| Ownership              | `AddressOwnershipChallenge` (nonce, message, expiry, consume-once)            |
| Network                | `ChainNetwork` — product registration limited to BTC/ETH/SOL/BSC/TRON/Polygon |
| Preferences            | User profile fields + existing prefs stores                                   |

**Private keys:** never in normal tables. Mobile vault remains device-local.

---

## APIs added / wired

| API                                                    | Purpose                                           |
| ------------------------------------------------------ | ------------------------------------------------- |
| Existing `/api/v1/auth/*`                              | register/login/refresh/logout/verify/forgot/reset |
| Existing `/api/v1/me/sessions                          | devices`                                          | list + revoke (CSRF now works from web) |
| `POST /api/v1/connections/watch`                       | public address register with validation           |
| `POST /api/v1/connections/ownership/challenge`         | nonce challenge (EVM)                             |
| `POST /api/v1/connections/ownership/verify`            | personal_sign recover + link                      |
| Existing `/api/v1/wallet-engine/portfolio`             | registered wallet portfolio                       |
| Existing `/api/v1/blockchain/balances/:chain/:address` | live balances (Alchemy server-side)               |
| Existing `/api/v1/blockchain/transactions`             | account activity                                  |

---

## Key files changed

### Auth / SDK / web session

- `packages/sdk/src/client.ts` — CSRF, auth helpers, watch/ownership/portfolio helpers
- `apps/web/src/lib/auth/session.ts`, `device.ts`, `api-client.ts`
- `apps/web/src/components/auth/*`, `apps/web/src/app/auth/*`, `apps/web/src/app/verify-email`
- `services/auth/src/application/services/auth.service.ts`, `env.schema.ts`, DTOs, device repo

### Account / public wallet / ownership

- `database/prisma/schema.prisma` + migration `20260802210000_one_account_public_wallet_foundation`
- `services/connections/src/application/services/connections-engine.service.ts`
- `services/connections/src/domain/supported-networks.ts`
- `services/connections/src/infrastructure/crypto/eth-personal-sign.ts`
- `apps/web/src/components/wallet/WatchOnlyExperience.tsx`

### Live portfolio / activity / honesty

- `apps/web/src/lib/portfolio/live-portfolio.ts`
- `apps/web/src/lib/activity/live-activity.ts`
- `apps/web/src/components/portfolio/PortfolioExperience.tsx` — Live/Cached/Demo/Unavailable badge

### Devices / Security / Reown web

- `apps/web/src/components/settings/DeviceManagementExperience.tsx`
- `apps/web/src/components/settings/SecurityCenterExperience.tsx`
- `apps/web/src/lib/reown/web-pairing.ts`
- `apps/web/src/components/web3/MobilePairingExperience.tsx` — Connect Auvora Mobile QR/deep-link

### Mobile (non-destructive)

- `apps/mobile/lib/ui/home/more_tab.dart` — Auvora account explainer (keys stay on device)

### Docs

- `docs/AUVORA_ENCRYPTED_CROSS_DEVICE_SECURITY_DESIGN.md`
- `docs/AUVORA_ONE_ACCOUNT_LIVE_ECOSYSTEM_REPORT.md` (this file)
- `.env.example` — `AUTH_ALLOW_UNVERIFIED_LOGIN`, `APP_PUBLIC_URL` note

---

## Phase gates (1–24)

| #   | Phase                                        | Gate                                                                                                      |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Audit existing auth (reuse)                  | **PASS** — reused auth/me/devices/sessions; no second auth system                                         |
| 2   | Canonical account models                     | **PASS** — User/Device/Session/Wallet/WatchAddress/Challenge; no keys in tables                           |
| 3   | Production-oriented web auth                 | **BETA / PARTIAL** — foundation complete; full env E2E **ENV VERIFICATION**                               |
| 4   | Mobile account relationship                  | **PASS** — vault untouched; account explainer; public-only sync story                                     |
| 5   | Device registration + revoke                 | **BETA** — register on login; list/revoke wired; coarse platform only                                     |
| 6   | Public wallet registration                   | **BETA** — watch + validation; keys never accepted                                                        |
| 7   | Chains BTC ETH SOL BSC TRON Polygon          | **PASS** — enforced in connections registration                                                           |
| 8   | Live web portfolio (Alchemy server-side)     | **PARTIAL** — loader + APIs wired; needs signed-in addresses + running services                           |
| 9   | Same portfolio reality (chain authoritative) | **PASS** (design) — no fake DB balance sync invented                                                      |
| 10  | Live web activity                            | **PARTIAL** — loader against blockchain txs; empty/unavailable honest                                     |
| 11  | Finish Reown web (same project)              | **PARTIAL** — Project ID + QR/deep-link foundation; live Universal Provider still **DEVICE VERIFICATION** |
| 12  | Connect Auvora Mobile QR/deep-link           | **BETA** — UI shipped; physical pair **DEVICE VERIFICATION REQUIRED**                                     |
| 13  | Ownership challenge                          | **BETA** — EVM personal_sign verify; non-EVM watch-only                                                   |
| 14  | Web→mobile approval; broadcast OFF           | **PASS** (invariant) — kill switch held; pipeline foundation via pair UI                                  |
| 15  | Security Center real state                   | **BETA** — live sessions/devices when API responds; demo only when unsigned                               |
| 16  | Devices & Sessions revocation                | **BETA** — real DELETE with CSRF; demo cannot revoke                                                      |
| 17  | Encrypted cross-device sync                  | **DESIGN ONLY** — see design doc; **not shipped**                                                         |
| 18  | DB security audit                            | **PASS** (this scope) — no mnemonic/key columns; ownership constraints/indexes added                      |
| 19  | API security                                 | **BETA** — CSRF, rate limit, ownership authz, replay/expiry on challenges; ongoing                        |
| 20  | Real vs demo honesty                         | **PASS** — Live/Cached/Demo/Unavailable labels on portfolio + devices                                     |
| 21  | Failure states                               | **PASS** — bounded timeouts; no infinite loading paths added                                              |
| 22  | Tests / builds                               | **PASS** (summaries below)                                                                                |
| 23  | Security invariants                          | **PASS** — all six MUST hold                                                                              |
| 24  | This report                                  | **PASS**                                                                                                  |

---

## Test / build summaries

| Check                                                        | Result                                                |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `pnpm db:generate` / `prisma generate`                       | PASS — includes `AddressOwnershipChallenge`           |
| Connections unit (`supported-networks`, `eth-personal-sign`) | PASS (4 tests)                                        |
| Auth unit (`password-policy`, `auth-web-foundation`)         | PASS (4 tests)                                        |
| Connections `tsc --noEmit`                                   | PASS                                                  |
| Web `pnpm typecheck`                                         | PASS                                                  |
| Web `pnpm build`                                             | PASS                                                  |
| Flutter `analyze`                                            | PASS — No issues found                                |
| Flutter `reown_walletconnect_security_test` + `widget_test`  | PASS (17 tests)                                       |
| Mobile Alchemy / Reown regression                            | No intentional regression; Reown security tests green |
| Physical Reown QR / Reown dashboard                          | **DEVICE VERIFICATION REQUIRED**                      |
| Full auth E2E against staging DB/mail                        | **ENV VERIFICATION REQUIRED**                         |

---

## Blockers / DEVICE VERIFICATION REQUIRED

1. **Physical Reown web↔mobile pairing** with same Cloud project (relay session restore on device).
2. **Auth mail path** in target environment (verify/reset links; console mail OK for local).
3. **Apply migration** `20260802210000_one_account_public_wallet_foundation` on each environment DB.
4. **Gateway + auth + connections + blockchain + wallet** services running for live portfolio/activity.
5. **Non-EVM ownership proofs** (BTC/SOL/TRON) — watch-only only in Alpha.
6. **Encrypted seed sync** — blocked pending security review of design doc.

---

## Prioritization honesty

Shipped coherent foundation:  
**real web auth plumbing → device/session → public address + ownership → server portfolio/activity → Security/Devices → Reown pairing UI → encrypted-sync design.**

Marked PARTIAL / DEVICE VERIFICATION where live multi-service or physical device proof is required — not fake PASS.

---

## Confirmations

- **No commit / no push** performed.
- **Secrets** from `.env` not printed.
- **Website redesign** not performed (premium reconstruction preserved).
- **Encrypted cross-device sync:** design only at `docs/AUVORA_ENCRYPTED_CROSS_DEVICE_SECURITY_DESIGN.md`.
