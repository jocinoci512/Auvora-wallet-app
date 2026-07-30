# Auvora Wallet — Full Project Audit Report

**Date:** 2026-07-30  
**Scope:** Entire monorepo (no new features; inventory only)  
**Channel context:** Mobile `1.1.0-beta.1` Closed Beta · Web Internal Alpha companion · Backend NestJS + Prisma

---

## Executive summary

Auvora is a mature **pnpm/turbo monorepo** with Flutter mobile, Next.js web/admin/docs, 17 NestJS services, and PostgreSQL/Prisma. Product UX for wallet journeys is largely built. **On-chain money movement is still preview/simulated** on mobile (kill switches off) and partially gateway-backed / partially stubbed on web.

**Do not rebuild** onboarding, Security Center, Settings, Home/Send/Receive shells, beta feedback, or Settings suite — improve them in place. **Highest-value work** is HD derivation, live adapters, deduping web routes, removing dead code, and aligning copy with reality.

| Area                         | Health                                                                      |
| ---------------------------- | --------------------------------------------------------------------------- |
| Mobile UX / auth lock        | Strong (Closed Beta)                                                        |
| Mobile blockchain            | Preview only — gated                                                        |
| Web companion UX             | Broad; many previews                                                        |
| Web typecheck / lint / build | Pass (verified this audit)                                                  |
| Flutter unit tests           | 63 passed                                                                   |
| Database                     | Schema + 21 migrations present; local Postgres **unreachable** this session |
| API gateway                  | Services exist; local stack not running (Docker unavailable)                |

---

## 1. Codebase scan — structure

| Layer        | Path                                    | Role                               |
| ------------ | --------------------------------------- | ---------------------------------- |
| Mobile       | `apps/mobile`                           | Flutter self-custody client        |
| Web          | `apps/web`                              | Next 15 companion + ops surfaces   |
| Admin / Docs | `apps/admin`, `apps/docs`               | Admin + docs sites                 |
| Services     | `services/*` (17)                       | NestJS microservices               |
| Packages     | `packages/*`                            | SDK, UI, security, secrets, types… |
| Database     | `database/prisma`                       | PostgreSQL Prisma schema           |
| Infra        | `infrastructure/`, `.github/workflows/` | Helm, CI/CD                        |

---

## 2. Completed features (keep; improve in place)

### Mobile

- Onboarding: create / import / BIP39 backup quiz / PIN / biometrics / permissions
- Device lock + background auto-lock; weak-PIN denylist; PIN lockout
- Home / Assets / Activity / More + search
- Guided Send + Receive UI (funding receive **intentionally locked**)
- Security Center, Settings, Diagnostics, Beta feedback
- Secure mnemonic storage (`flutter_secure_storage`)
- Sync coordinator, retries, offline SoftBanners (Sprint 9)
- Auvora Intelligence guidance layer (Sprint 10)

### Web

- Marketing, dashboard, portfolio, learn, assistant, insights
- Full Settings suite including Closed Beta feedback (`/settings/feedback`)
- Web3 hub + permissions UX
- Gateway-backed CRUD when JWT + `NEXT_PUBLIC_API_URL` available (wallets, blockchain, payments, custody, compliance, analytics, status)
- Legal / Trust / Status
- Privacy defaults opt-in; sessionStorage access tokens

### Platform

- Prisma schema + migrations; secrets package; CI workflows; SDK package

---

## 3. Partially completed features

| Feature                            | Status                                  | Guidance                                   |
| ---------------------------------- | --------------------------------------- | ------------------------------------------ |
| Address derivation                 | SHA preview, not BIP32                  | Improve `wallet_crypto.dart` — do not fork |
| Live broadcast                     | Kill switch off; Preview adapters       | Extend adapters — do not duplicate engine  |
| Swap / Bridge / Stake / Buy / Sell | Quote/preview theater (mobile + web)    | Harden honesty + wire gateway when ready   |
| WalletConnect / dApps              | Seeded preview sessions; iframe browser | Improve `connections_controller` / web3    |
| Hardware wallet                    | Web setTimeout pairing theater          | Refactor existing experience               |
| Push notifications                 | In-app inbox only                       | Extend prefs/inbox — no second center      |
| Multi-wallet                       | Preview wallet rows                     | Extend preferences models                  |
| Crash reporting                    | Consent prefs; no Sentry wire           | Wire or relabel — no duplicate Privacy UI  |
| Screenshot protection              | Android only                            | Extend MethodChannel for iOS               |
| Argon2id PIN                       | Iterated SHA-256 v2                     | Upgrade `WalletCrypto` in place            |
| l10n                               | EN Material delegates only              | Add ARB — do not invent parallel i18n      |
| Web biometrics                     | Preference flag, no WebAuthn            | Improve Security experiences               |

---

## 4. Broken / misleading (fix before new features)

| Issue                                                      | Where                               | Action                               |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| `requireAuthForSend` / biometrics-for-unlock prefs unwired | Mobile security models + UI         | Wire or remove claims                |
| Fake dApp seed contradicts “trust theater removed”         | `connections_controller.dart`       | Stop seeding unknowns by default     |
| Buy CTA “Authenticate & pay” overclaims                    | `BuyExperience.tsx`                 | Rename to preview confirm            |
| AccessTokenPanel docs say localStorage                     | Web panel vs `api-client.ts`        | Align copy to sessionStorage         |
| Invalid BTC-style preview addresses                        | `deriveAddressForNetwork`           | Fix when HD ships; keep funding lock |
| Stale “Internal Alpha” copy                                | Security Center / wallet_controller | Update to Closed Beta wording        |
| Mobile README still “Sprint 1”                             | `apps/mobile/README.md`             | Refresh                              |

---

## 5. Duplicate files / surfaces

| Duplicate                                                             | Prefer                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `dashboard_screen.dart` vs `HomeShell`                                | Keep HomeShell; remove or archive Dashboard               |
| `lib/engine` vs `lib/wallet_engine`                                   | Keep both roles but document boundary; avoid third engine |
| Web `/portfolio` ≡ `/market/portfolio`                                | Single route                                              |
| `/security` vs `/settings/security`                                   | Clarify product vs settings Security Center               |
| `/connections` vs `/web3/*`                                           | Prefer `/web3`                                            |
| `/notifications` vs `/settings/notifications`                         | Consolidate                                               |
| Docs: many RELEASE / DEPLOY / Alchemy / Production readiness variants | Index + archive stale                                     |

---

## 6. Unused code

| Item                                                | Notes                               |
| --------------------------------------------------- | ----------------------------------- |
| `go_router` dependency (mobile)                     | Unused — remove when safe           |
| `dashboard_screen.dart`                             | Unreferenced by AppShell            |
| `_demoDevices/_demoSessions/_demoDapps/_demoAlerts` | Dead statics in security_controller |
| `Subnav.tsx`, `OfflineAware.tsx`                    | Unused web components               |
| NFT / digital-assets routes                         | Redirect shells only                |
| Image remotePatterns for NFT CDNs                   | No NFT UI                           |

Inline `TODO`/`FIXME` in product source: essentially **none** (Flutter Android template comments only). Debt is structural, not tagged.

---

## 7. Outdated architecture

- Mobile stage machine (`AppStage`) instead of declared `go_router` (dependency leftover)
- Backend microservices mature; local Docker DB not available in this audit environment
- Docs sprawl (Sprint 1–10 + RM1/RM2 + phase reports) without a single current “source of truth” beyond this audit + RM2 reports
- Root package `1.0.0-rc.1` vs mobile `1.1.0-beta.1` version skew

---

## 8. Build status (verified this audit)

| Check                                       | Result                                 |
| ------------------------------------------- | -------------------------------------- |
| `pnpm --filter @auvora/web typecheck`       | **Pass**                               |
| `pnpm --filter @auvora/web lint` (eslint)   | **Pass**                               |
| `pnpm --filter @auvora/web exec next build` | **Pass** (exit 0)                      |
| `flutter test` (mobile)                     | **63 passed**                          |
| Node engine                                 | Warn: package wants 22.x; host is 24.x |

---

## 9. Database status

| Item           | Status                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Prisma schema  | Present (`database/prisma/schema.prisma`, PostgreSQL)                  |
| Migrations     | 21 migration folders                                                   |
| `DATABASE_URL` | Set in root `.env`                                                     |
| Connectivity   | **Fail** — `localhost:5432` unreachable (Docker not available in PATH) |
| Supabase       | Not used                                                               |

**Action:** Start Postgres via `docker-compose` before migrate/status claims for local prod parity.

---

## 10. API integrations

| Integration                                                      | Reality                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `@auvora/sdk` → gateway (`NEXT_PUBLIC_API_URL`, default `:4000`) | Real client; needs running gateway                        |
| Mobile blockchain                                                | **No** live RPC — PreviewBlockchainAdapter only           |
| Alchemy / market-data services                                   | Documented + service code; not verified live this session |
| Crash/analytics SDKs                                             | Consent only — not wired                                  |
| WalletConnect protocol                                           | Preview/seeded — not production WC                        |

---

## 11. Routing

### Mobile

- `AppShell` + `AppStage` switcher (not go_router)
- Dashboard after unlock → `HomeShell` tabs

### Web (~85 App Router pages)

- Core wallet + settings + web3 + ops SDK pages present
- No `middleware.ts`
- Dead/redirect: `/nfts/*`, `/digital-assets`, `/ai` → `/assistant`

---

## 12. State management

| Client | Pattern                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Mobile | `provider` MultiProvider + ChangeNotifiers                                                                                       |
| Web    | Local React state + many `localStorage` / `sessionStorage` keys; Theme/Toast/Online providers — **no** Redux/Zustand/React Query |

---

## 13. Authentication

| Surface                                  | Status                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| Mobile PIN + biometrics + session unlock | Working for Closed Beta                              |
| Mobile fail-closed sensitive auth        | Improved in RM1/RM2                                  |
| Web JWT                                  | Manual paste → sessionStorage Bearer                 |
| Web device PIN                           | SHA-256 local theater                                |
| Backend auth service                     | Exists (`services/auth`); not exercised this session |

---

## 14. Blockchain integrations

| Claim                      | Reality                                               |
| -------------------------- | ----------------------------------------------------- |
| Multi-chain wallet         | Preview adapters (`btc-sim`, `eth-sim`, …)            |
| BIP32 / SLIP-0010          | **Not implemented**                                   |
| Live broadcast             | **Disabled** (`liveBroadcastEnabled=false`)           |
| Funding addresses          | **Locked** (`allowFundingAddresses=false`)            |
| Backend blockchain service | Present for gateway ops; separate from mobile signing |

---

## 15. Mobile compatibility

- Flutter iOS/Android/tablet; orientation support; wide breakpoints
- Face ID / biometrics plist & USE_BIOMETRIC
- Screenshot FLAG_SECURE Android-only
- Unit tests green; physical device matrix still open (RM2 KI-H01)

---

## 16. Web compatibility

- Next 15 App Router; production build succeeds
- Companion framing + `noindex` for Alpha
- a11y: skip link present; many `window.confirm` money flows; reduce-motion partial
- Node 24 vs engines 22.x warning

---

## Recommended order of work (improve existing first)

1. **Do not add new product chrome** until KI-C01 (BIP32) and live adapters progress
2. Remove / archive dead: `dashboard_screen`, unused `go_router`, demo statics, unused web components
3. Fix overclaims: Buy CTA, AccessTokenPanel copy, Internal Alpha strings, dApp seeding
4. Deduplicate web routes (portfolio, security, notifications, connections)
5. Start local Postgres + gateway; verify migrate status + SDK smoke
6. Continue privacy wiring (crash reporter or honest labels; iOS screenshot)

---

## Audit verification checklist

| Gate                              | Status                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Successful production build (web) | **Pass**                                                                                              |
| No TypeScript errors (web)        | **Pass**                                                                                              |
| No lint errors (web eslint)       | **Pass**                                                                                              |
| No runtime errors (audit session) | **Not fully exercised** — DB/gateway down; unit tests green                                           |
| No broken navigation (inventory)  | **Mostly intact**; some duplicate/orphan routes                                                       |
| No placeholder UI                 | **Fail** — advanced flags, WC QR, dApp browser, hardware, NFT redirects remain placeholders by design |
| No TODOs                          | **Pass** in product TS/Dart (template Gradle comments only)                                           |
| Updated implementation report     | **This document**                                                                                     |

---

## Verdict

**Audit complete. Ready for improvement-first work — not greenfield rebuilds.**

Treat RM2 Closed Beta gates as current truth: simulated rails, funding locked, feedback live. Next implementation prompts should **refactor existing modules** toward production crypto rails and honesty, never duplicate Home/Security/Settings/Send/Receive.
