# Auvora — Technical Leadership: Next Steps (Local Ecosystem Activation)

**Date:** 2026-08-02  
**Workspace:** `D:\auvora-wallet`  
**Authority:** Local activation for real testing — no broadcast, no seed sync, no redesign, no commit/push.  
**Companion:** `docs/AUVORA_LIVE_ECOSYSTEM_DEVICE_TEST.md`

---

## Decisions made (and why)

| Decision                                                                  | Rationale                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefer **embedded Postgres + Redis** when Docker CLI is absent            | Machine had no `docker` on PATH; `scripts/start-local-data.mjs` + existing `.local-data/postgres` cluster already present. Avoids blocking on Docker Desktop install for local E2E. |
| Fix `start-local-data.mjs` to **skip `initdb` when `PG_VERSION` exists**  | Prior runs left a non-empty data dir; blind `initialise()` always failed. Matches `migrate-with-embedded-pg.mjs` pattern.                                                           |
| Generate local JWT/CSRF/`INTERNAL_API_KEY` **only when placeholders**     | Auth cannot boot with `change-me` secrets. Values written to gitignored `.env` only; never logged/committed.                                                                        |
| Point `APP_PUBLIC_URL` at **web `:3000`**, not gateway `:4000`            | Verify/reset email links must hit Next auth routes.                                                                                                                                 |
| Sync `NEXT_PUBLIC_WC_PROJECT_ID` from `WC_PROJECT_ID`                     | Same public Reown Project ID web+mobile; was MISSING locally.                                                                                                                       |
| Clear `COOKIE_DOMAIN=localhost` + ignore empty/localhost in cookie helper | Host-only cookies; `Domain=localhost` breaks browsers. Path remains `/`.                                                                                                            |
| Prefer `AUTH_PORT` over root `PORT` in auth `loadEnv`                     | Monorepo `.env` sets `PORT=4000` for gateway; auth was binding 4000 → `EADDRINUSE`.                                                                                                 |
| Add **Mailpit** under `docker compose --profile mail`                     | Real local inbox when Docker returns; no fake SMTP. Until then `MAIL_DRIVER=console` remains valid.                                                                                 |
| Ship `scripts/activate-local-ecosystem.ps1` readiness board               | One command for ports / migrate / env key PRESENT\|MISSING\|PLACEHOLDER (no values).                                                                                                |
| Keep production web/API deploy as **Kwasi-only**                          | No linked Vercel project; live site still old marketing; no push.                                                                                                                   |

---

## What was automated this pass

1. Hardened local `.env` (secrets, URLs, WC public ID, cookie domain, `AUTH_ALLOW_UNVERIFIED_LOGIN=true` for local).
2. Started embedded data plane (Postgres **5432**, Redis **6379**).
3. `pnpm --filter @auvora/database-schema migrate:deploy` — **22 migrations**, schema up to date (incl. one-account foundation).
4. Started **auth :4001** + **gateway :4000**; health **200**; register smoke **201** (no tokens printed).
5. DX: activation script, Mailpit compose profile, `.env.example` guidance, auth port/cookie fixes, clearer auth API error copy, web-pairing test isolation.
6. Regression: Flutter analyze + 17 tests PASS; web typecheck PASS; web tests re-run after pairing test fix.

---

## Still requires Kwasi (ordered)

1. **Install Docker Desktop** (recommended) _or_ keep using embedded data plane for local-only. Mailpit needs Docker.
2. **Start Next web locally:** `. .\scripts\load-env.ps1` then `pnpm --filter @auvora/web dev` → exercise `/auth/register`, `/auth/login`, `/web3/pair`.
3. **Sideload APK** `D:\auvora-build\dist\ecosystem-test\auvora-wallet-ecosystem-test.apk` and run device checklist §B–O.
4. **Production:** deploy current `apps/web` + API stack; set hoster env (`NEXT_PUBLIC_API_URL`, CORS/cookies, SMTP, prod JWT/CSRF — **new** secrets, do not reuse local).
5. Optional: Digital Asset Links for `wallet.auvora.app`; confirm Reown Cloud project ID matches web+mobile.

---

## Recommended production sequence

1. Local E2E green (auth → watch address → Alchemy portfolio → Reown deep link) with broadcast **OFF**.
2. Staging API + DB migrate deploy (never reset).
3. Staging web with baked `NEXT_PUBLIC_*`.
4. Real SMTP + `COOKIE_SECURE` + verified CORS.
5. Production cutover; Universal Provider only after pairing foundation proven.
6. Broadcast enablement only with explicit product sign-off.

---

## Security invariants (unchanged)

Broadcast **OFF** · no keys/seeds server-side · no Alchemy in browser/APK · no Reown Secret client-side · NFT **ABSENT** · encrypted seed sync **not implemented**.

---

## Commit / push

**NOT performed.**
