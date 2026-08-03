# Auvora — Live Ecosystem Device Test Checklist

**Date:** 2026-08-02 (activation refresh)  
**Workspace:** `D:\auvora-wallet`  
**Purpose:** Make existing one-account + Reown + Alchemy work **testable**. No redesign. No encrypted seed sync. No live broadcast. No commit/push.  
**APK target:** `D:\auvora-build\dist\ecosystem-test\auvora-wallet-ecosystem-test.apk`  
**Leadership memo:** `docs/AUVORA_TECHNICAL_LEADERSHIP_NEXT_STEPS.md`  
**Related reports:**

- `docs/AUVORA_ONE_ACCOUNT_LIVE_ECOSYSTEM_REPORT.md`
- `docs/AUVORA_ENCRYPTED_CROSS_DEVICE_SECURITY_DESIGN.md` (design only)
- `docs/AUVORA_PREMIUM_WEB_ECOSYSTEM_RECONSTRUCTION_REPORT.md`
- `docs/REOWN_WALLETCONNECT_PRODUCTION_INTEGRATION_REPORT.md`
- `docs/ALCHEMY_LIVE_PRODUCTION_INTEGRATION_REPORT.md`

---

## E. Ready / Blocked / First action

| Bucket                        | Items                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ready without your action** | Android APK built; mobile Reown WalletKit; deep links; local Postgres+Redis **UP** (embedded); migrations **applied** (22); local JWT/CSRF/INTERNAL secrets generated; `APP_PUBLIC_URL` → web `:3000`; `NEXT_PUBLIC_WC_PROJECT_ID` synced; gateway **:4000** + auth **:4001** health OK; register path smoke 201; portfolio honesty; activation script |
| **Blocked until your action** | Docker Desktop (optional but needed for Mailpit/compose); local Next web process for browser E2E; production web deploy (`/auth/login`, `/web3/pair` still 404 live); production API + prod secrets/SMTP/CORS; Universal Provider full live WC on web; DAL for `wallet.auvora.app`                                                                     |
| **First thing you should do** | **Start local web** (`. .\scripts\load-env.ps1` then `pnpm --filter @auvora/web dev`) and run auth + `/web3/pair` against the already-running gateway/auth. Then sideload the APK.                                                                                                                                                                     |

---

## Activation status (agent 2026-08-02)

| Component                         | Status                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Docker CLI                        | **NOT on PATH** — used embedded data plane instead                                                        |
| Postgres `:5432`                  | **UP** (`scripts/start-local-data.mjs`, persistent `.local-data/postgres`)                                |
| Redis `:6379`                     | **UP** (redis-memory-server)                                                                              |
| Prisma migrate deploy             | **DONE** — all 22 migrations applied; schema up to date                                                   |
| Local secrets (JWT/CSRF/INTERNAL) | **GENERATED** into gitignored `.env` (placeholders only; values not logged)                               |
| `APP_PUBLIC_URL`                  | **FIXED** → `http://localhost:3000`                                                                       |
| `NEXT_PUBLIC_WC_PROJECT_ID`       | **SET** (synced from `WC_PROJECT_ID`)                                                                     |
| `COOKIE_DOMAIN`                   | **CLEARED** for host-only local cookies                                                                   |
| Mail                              | Still `MAIL_DRIVER=console` — links in auth logs; Mailpit profile added to compose for when Docker exists |
| Gateway `:4000`                   | **UP** — `/health` 200                                                                                    |
| Auth `:4001`                      | **UP** — `/health` 200; prefers `AUTH_PORT` over root `PORT`                                              |
| Register smoke                    | **201** via auth (no tokens printed)                                                                      |
| Next web `:3000`                  | **Not started this pass** — start for browser E2E                                                         |
| Readiness board                   | `powershell -File scripts/activate-local-ecosystem.ps1`                                                   |

---

## A. External actions matrix (remaining only)

Do these in order. Rows completed by the agent are marked **DONE**.

| #   | SERVICE                       | WHAT IS REQUIRED       | CURRENT STATUS                                      | CURSOR CAN COMPLETE?   | USER MUST COMPLETE?                            |
| --- | ----------------------------- | ---------------------- | --------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| 1   | **Local Postgres**            | DB listening           | **DONE** — embedded UP                              | Done                   | No (unless you prefer Docker)                  |
| 2   | **Local Redis**               | Sessions / rate limits | **DONE** — memory server UP                         | Done                   | No                                             |
| 3   | **Prisma migrations**         | Apply all              | **DONE** — up to date                               | Done                   | Only for prod/staging DB                       |
| 4   | **Auth JWT / CSRF**           | Non-placeholder        | **DONE locally**                                    | Done local             | **YES** for prod (new secrets)                 |
| 5   | **Auth mail (SMTP)**          | Real inbox             | Console OK for local; Mailpit when Docker installed | Partial                | **YES** for prod SMTP                          |
| 6   | **`APP_PUBLIC_URL`**          | Web origin             | **DONE locally** (`:3000`)                          | Done local             | **YES** set prod to `https://auvorawallet.com` |
| 7   | **CORS + cookies**            | Cross-origin           | Local OK; cookie helper ignores `localhost` domain  | Done local             | **YES** for prod domains                       |
| 8   | **`NEXT_PUBLIC_API_URL`**     | Web → gateway          | Local template OK                                   | —                      | **YES** bake on web host                       |
| 9   | **Production web deploy**     | Ship latest `apps/web` | Live still **404** on `/auth/login`, `/web3/pair`   | **NO**                 | **YES**                                        |
| 10  | **Backend / API deploy**      | Prod gateway+auth+…    | Local up; prod not verified                         | **NO**                 | **YES**                                        |
| 11  | **Docker Desktop** (optional) | Compose + Mailpit      | Not installed                                       | **NO**                 | **YES** if you want compose/Mailpit            |
| 12  | **Reown Cloud**               | Same Project ID        | Local web+mobile IDs aligned                        | Done local             | Confirm dashboard; set prod web env            |
| 13  | **Android DAL**               | Optional App Links     | Code only                                           | Partial                | **YES**                                        |
| 14  | **Domain DNS / TLS**          | Public HTTPS           | Site resolves; stack outdated                       | **NO**                 | **YES**                                        |
| 15  | **Alchemy**                   | Networks               | Local key PRESENT; server-only                      | Re-smoke after backend | Only if networks disabled                      |
| 16  | **Encrypted seed sync**       | Out of scope           | Design only                                         | N/A                    | Do **not** enable                              |

### Local bring-up (already activated once)

```powershell
cd D:\auvora-wallet
# Data plane (if ports down):
node scripts/start-local-data.mjs
# Or readiness + optional flags:
powershell -File scripts/activate-local-ecosystem.ps1 -StartDataPlane -MigrateDeploy

# Services (load env; auth uses AUTH_PORT):
. .\scripts\load-env.ps1
$env:PORT = $env:AUTH_PORT
cmd /c "pnpm --filter @auvora/auth-service dev"
cmd /c "pnpm --filter @auvora/gateway-service dev"
pnpm --filter @auvora/web dev
```

If migrate fails against a shared DB, **stop** — do not reset.

---

## B. Physical / environment checklist (sections A–T)

Mark **PASS / FAIL** during your run. No real-money broadcast.

### A — Preflight (machine)

| ACTION                        | EXPECTED RESULT                                             | PASS/FAIL | NOTES |
| ----------------------------- | ----------------------------------------------------------- | --------- | ----- |
| Confirm kill switches in code | `liveBroadcastEnabled=false`, `allowFundingAddresses=false` |           |       |
| Confirm NFT product absent    | `/nfts` redirects; no NFT IA                                |           |       |
| Install ecosystem APK         | Sideload APK from §APK                                      |           |       |
| Unlock / create mobile vault  | Local vault only; no seed upload                            |           |       |

### B — Local data plane

| ACTION                 | EXPECTED RESULT                   | PASS/FAIL        | NOTES                     |
| ---------------------- | --------------------------------- | ---------------- | ------------------------- |
| Start Postgres + Redis | Ports up                          | **PASS** (agent) | Embedded; Docker optional |
| `migrate:deploy`       | All migrations applied            | **PASS** (agent) | 22 migrations             |
| Start gateway + auth   | `http://127.0.0.1:4000/health` OK | **PASS** (agent) | Auth `:4001` also OK      |

### C — Auth register / login (local web)

| ACTION                                      | EXPECTED RESULT                  | PASS/FAIL | NOTES                                 |
| ------------------------------------------- | -------------------------------- | --------- | ------------------------------------- |
| Open `http://localhost:3000/auth/register`  | Register UI; password policy ≥12 |           | Start web first                       |
| Register new user                           | Success; mail path per driver    | Partial   | API register 201 smoked; UI needs web |
| If `MAIL_DRIVER=console`                    | Verification link in auth logs   |           |                                       |
| Verify email / sign in / refresh / sign out | Session + CSRF                   |           |                                       |

### D–T

(Unchanged expectations — run after web + APK. See prior sections in git history / complete during device run.)

**Highlights to verify:** signed-in portfolio never silent demo; `/web3/pair` shows Project ID configured; WC paste/approve never auto-approve; broadcast refused; no Alchemy in APK.

---

## C. Final gates (activation refresh)

| Gate               | Verdict                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| ANDROID TEST APK   | **READY** — `auvora-wallet-ecosystem-test.apk` (SHA below)                                |
| LOCAL DATA PLANE   | **READY** — Postgres + Redis up; migrations applied                                       |
| LOCAL AUTH API     | **READY** — health + register smoke                                                       |
| LOCAL WEB UI       | **PENDING** — start `pnpm --filter @auvora/web dev`                                       |
| PRODUCTION WEB     | **NOT READY** — latest routes 404; old homepage                                           |
| PRODUCTION AUTH    | **NOT VERIFIED**                                                                          |
| LIVE WEB PORTFOLIO | **NOT VERIFIED** (needs web UI + linked addresses; API path ready locally)                |
| LIVE WEB ACTIVITY  | **NOT VERIFIED**                                                                          |
| REOWN WEB→ANDROID  | Deep-link/QR **prep READY** locally; full Universal Provider **NOT READY**; prod pair 404 |
| ALCHEMY            | **VERIFIED** prior + local key present — re-smoke with backend                            |
| BROADCAST          | **MUST BE OFF**                                                                           |

---

## D. Security invariants (re-verified)

| Invariant                                | Status              |
| ---------------------------------------- | ------------------- |
| PLAINTEXT PRIVATE KEYS/SEEDS SERVER-SIDE | **NO**              |
| PRIVATE KEYS THROUGH REOWN               | **NO**              |
| ALCHEMY PRIVILEGED KEY IN BROWSER        | **NO**              |
| ALCHEMY KEY IN APK                       | **NO**              |
| REOWN SECRET IN BROWSER/APK              | **NO**              |
| NFT                                      | **ABSENT**          |
| LIVE TRANSACTION BROADCAST               | **OFF**             |
| ENCRYPTED SEED SYNC                      | **NOT IMPLEMENTED** |

---

## APK build

| Field   | Value                                                                  |
| ------- | ---------------------------------------------------------------------- |
| Script  | `scripts/build-ecosystem-test-apk.ps1`                                 |
| Output  | `D:\auvora-build\dist\ecosystem-test\auvora-wallet-ecosystem-test.apk` |
| Version | `1.0.0-alpha.1+5`                                                      |
| Signing | Debug keystore                                                         |
| WC      | `--dart-define=WC_PROJECT_ID` from root `.env`                         |
| Alchemy | **Not** injected                                                       |

```
APK_PATH=D:\auvora-build\dist\ecosystem-test\auvora-wallet-ecosystem-test.apk
APK_SIZE_BYTES=88303259
APK_SHA256=81a285b872f5eef3356cc4486cddc0d74789b4793164904be00424980ad7de85
```

### Regression (activation pass)

| Check                           | Result                 |
| ------------------------------- | ---------------------- |
| `flutter analyze`               | PASS — No issues found |
| Flutter security + widget tests | PASS (17)              |
| Web `pnpm typecheck`            | PASS                   |
| Web `pnpm test`                 | PASS (24)              |
| Commit / push                   | **NOT performed**      |

---

## ONE NEXT ACTION FOR KWASI

**Start the local web app against the running API**, then walk auth + pair:

```powershell
cd D:\auvora-wallet
. .\scripts\load-env.ps1
pnpm --filter @auvora/web dev
# Open http://localhost:3000/auth/register and http://localhost:3000/web3/pair
```

(If gateway/auth were stopped, re-run the Local bring-up block above first, or `powershell -File scripts/activate-local-ecosystem.ps1`.)

---

## Commit / push

**NOT performed** (per instructions).
