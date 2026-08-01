# Auvora — Migration and Backup Report

**Date:** 2026-08-01  
**Purpose:** Confirm GitHub is the authoritative cloud copy of **source code**, and list every important **local-only** asset that must be copied separately before retiring this PC.  
**Action taken:** Read-only audit + `git fetch`. No secrets were committed. Working tree was already clean and pushed.

---

## Executive verdict

| Question                                                      | Answer                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Is Auvora **source code** fully on GitHub?                    | **YES** — `main` @ `3b87707` matches `origin/main`                                                                |
| Is it safe to delete this local project folder **right now**? | **NO** — not until you separately back up items in §8–§10                                                         |
| Can another Windows PC clone and rebuild from GitHub?         | **YES** (source + docs + templates), after installing Flutter/Android SDK and restoring secrets/signing if needed |

---

## 1. Git audit (verified)

### Commands / results

| Check                           | Result                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `git status`                    | On `main`, **up to date** with `origin/main`, **nothing to commit**, working tree **clean** |
| `git branch -vv`                | `* main 3b87707 [origin/main] fix: stabilize widget boot tests after restore timeout`       |
| `git remote -v`                 | `origin` → `https://github.com/jocinoci512/Auvora-wallet-app.git` (fetch + push)            |
| `git log -5 --oneline`          | See below                                                                                   |
| `git log origin/main..HEAD`     | _(empty — no unpushed commits)_                                                             |
| Local-only branches             | **None** (only `main` + `remotes/origin/main`)                                              |
| `git rev-parse HEAD`            | `3b877072fd4210c69d97e7809a9d7f9056799e63`                                                  |
| `git ls-remote` / `origin/main` | `3b877072fd4210c69d97e7809a9d7f9056799e63`                                                  |
| **Local HEAD matches GitHub?**  | **YES**                                                                                     |

### Recent commits

```
3b87707 fix: stabilize widget boot tests after restore timeout
d5f3850 fix: harden Alpha restore timeouts and integration readiness
a7bea54 fix: stabilize Android Alpha biometrics, sync, and prices
98fb966 docs: add Alpha release verification and QA checklists
7a7dd74 feat: polish mobile UI for premium Alpha experience
```

---

## 2. GitHub repository

| Field                         | Value                                            |
| ----------------------------- | ------------------------------------------------ |
| **GitHub repository URL**     | https://github.com/jocinoci512/Auvora-wallet-app |
| **Current branch**            | `main`                                           |
| **Latest commit hash**        | `3b877072fd4210c69d97e7809a9d7f9056799e63`       |
| **Local HEAD matches GitHub** | **YES**                                          |

---

## 3. Working tree inventory

| Category            | Count / status |
| ------------------- | -------------- |
| Modified files      | **0**          |
| Untracked files     | **0**          |
| Unpushed commits    | **0**          |
| Local-only branches | **0**          |

Nothing additional needed to push for source/docs/tests/templates.

---

## 4. Important files intentionally **not** on GitHub (via `.gitignore`)

Root `.gitignore` excludes (among others): `node_modules`, `dist`, `build`, `.next`, `.env` / `.env.local` / `.env.production` / `.env.staging`, `**/*.tfvars`, `**/secrets/*.yaml`, `.tools`, `*.pem`, `.local-data`, Prisma local DBs, Docker data.

Android (`apps/mobile/android/.gitignore`) excludes: `local.properties`, `key.properties`, `**/*.keystore`, `**/*.jks`.

### Present on this machine but **not** in Git

| Path                                         | Why excluded                                  | Migration action                                                              |
| -------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `C:\Users\kwasi\Projects\auvora-wallet\.env` | Secrets / service config                      | **Copy to encrypted backup** (USB/password manager vault). Do **not** commit. |
| `apps\web\.env.local`                        | Local Next public config                      | Copy if you need identical web local URL settings                             |
| `key.properties`                             | **Not present** on disk                       | Template only: `apps/mobile/android/key.properties.example` (in Git)          |
| Upload `.jks` / release keystore             | **Not found** under project                   | If you create one later, store offline; never commit                          |
| `%USERPROFILE%\.android\debug.keystore`      | OS-level Android debug signing                | Optional; new PC can generate a new debug keystore (new debug signature)      |
| `%USERPROFILE%\.config\alchemy\`             | Alchemy CLI auth + **local wallet key files** | **Critical separate backup** if you keep that CLI wallet                      |
| `D:\auvora-build\dist\**\*.apk`              | Release artifacts (gitignored `dist`/build)   | Copy APKs you still need for sideload/testing                                 |
| `D:\auvora-build\gradle-home`                | Gradle cache                                  | Regenerable — do not need to copy                                             |
| `C:\Users\kwasi\flutter`                     | Flutter SDK install                           | Install fresh on new PC (or copy SDK if preferred)                            |
| `.tools\` (if present under repo)            | Tooling / engine copies                       | Regenerable / ignored                                                         |

### Templates that **are** on GitHub (safe)

- `.env.example`, `.env.staging.example`, `.env.production.example`
- `apps/mobile/.env.example` (dart-define checklist)
- `apps/mobile/android/key.properties.example`
- Terraform `*.tfvars.example`
- Docs: API guide, Alpha reports, migration-related docs, `tools/alchemy_session_reconnect.ps1`

---

## 5. Secrets that must be backed up **separately** (never GitHub)

From local `.env` **key names only** (values not recorded here):

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
- `INTERNAL_API_KEY`
- `SEED_ADMIN_PASSWORD` (+ related seed admin fields)
- `SMTP_PASS` / mail credentials
- `COMPLIANCE_FIELD_ENCRYPTION_KEY`, `CUSTODY_FIELD_ENCRYPTION_KEY`, `SWAP_FIELD_ENCRYPTION_KEY`, `NFT_FIELD_ENCRYPTION_KEY`, `STAKING_FIELD_ENCRYPTION_KEY`, `CONNECTIONS_FIELD_ENCRYPTION_KEY`, `BRIDGE_FIELD_ENCRYPTION_KEY`
- `ALCHEMY_API_KEY` (if populated)
- `DATABASE_URL`, `REDIS_URL` (may contain credentials)
- Any future: `COINGECKO_API_KEY`, `WC_PROJECT_ID`, MoonPay/Ramp/Transak, Sentry DSN, upload keystore passwords

**Also separate from Git:**

- Alchemy CLI local private key files under `%USERPROFILE%\.config\alchemy\wallet-keys\`
- Any recovery phrases / wallet seeds used in the **mobile app on a phone** (those live on-device secure storage — **not** in this repo)
- Production/upload keystore + passwords (when created)

---

## 6. Android signing (local-only checklist)

| Item                       | Status on this PC                            | GitHub               |
| -------------------------- | -------------------------------------------- | -------------------- |
| `key.properties.example`   | Present                                      | **Yes**              |
| `key.properties`           | **Missing** (never created / already absent) | Ignored              |
| Upload `auvora-upload.jks` | **Not found** in project                     | Must stay out of Git |
| Debug builds               | Use Android debug keystore                   | Machine-local        |

**Implication:** Another PC can rebuild **debug/Alpha sideload APKs** without a release keystore. **Play Store upload signing** still requires creating/restoring a keystore + `key.properties` offline.

---

## 7. Generated release artifacts (not on GitHub)

Located under `D:\auvora-build\dist\` (copy if you need the binaries without rebuilding):

| Folder                               | Example APK                                     | ~Size  |
| ------------------------------------ | ----------------------------------------------- | ------ |
| `alpha-1.0.0`                        | `auvora-wallet-1.0.0-alpha-sprint1-release.apk` | ~80 MB |
| `alpha-1.0.0-stabilization-sprint-1` | sprint1 release                                 | ~80 MB |
| `alpha-1.0.0-stabilization-sprint-2` | sprint2 release                                 | ~41 MB |
| `alpha-1.0.0-recovery-sprint`        | recovery release                                | ~41 MB |
| `alpha-1.0.0-api-integrations`       | api-integrations                                | ~41 MB |
| `alpha-1.0.0-session-reconnect`      | **latest reconnect build**                      | ~41 MB |

Recommended keep: at least  
`D:\auvora-build\dist\alpha-1.0.0-session-reconnect\auvora-wallet-1.0.0-alpha-session-reconnect.apk`  
(+ SHA if present).

---

## 8. Push verification

| Step                               | Result                         |
| ---------------------------------- | ------------------------------ |
| Safe source/docs/templates to push | Already on GitHub (clean tree) |
| Secrets committed?                 | **No**                         |
| Push required this audit?          | **No** (already synced)        |
| Post-fetch HEAD == origin/main     | **YES** (`3b87707…`)           |

---

## 9. Can another Windows PC clone and rebuild?

**Yes**, for source rebuild, with:

1. Git clone of this repo
2. Flutter SDK (recommend stable 3.x matching prior builds; was `C:\Users\kwasi\flutter`)
3. Android Studio / SDK + cmdline-tools
4. Node.js for `apps/web` and monorepo scripts
5. Copy `.env` from encrypted backup → repo root (gitignored)
6. Optional: `--dart-define=ALCHEMY_API_KEY=…` etc. per `apps/mobile/.env.example`
7. Optional: create `apps/mobile/android/key.properties` from example for release signing

Rebuild mobile (example):

```bat
cd apps\mobile
flutter pub get
flutter analyze lib test
flutter test
flutter build apk --release --target-platform android-arm64
```

Web:

```bat
cd apps\web
npm install
npm test
npm run build
```

---

## 10. Exact clone / setup instructions (new PC)

```bat
git clone https://github.com/jocinoci512/Auvora-wallet-app.git
cd Auvora-wallet-app
git checkout main
git log -1 --oneline
REM Expect: 3b87707 fix: stabilize widget boot tests after restore timeout
```

Then:

1. Install [Flutter](https://docs.flutter.dev/get-started/install/windows) + Android SDK; run `flutter doctor`.
2. Restore **encrypted** copy of `.env` into repo root (never commit).
3. Optionally restore `apps/web/.env.local`.
4. Optionally restore Alchemy CLI config/keys from `%USERPROFILE%\.config\alchemy\` backup.
5. `cd apps\mobile && flutter pub get`.
6. Read `docs/API_AND_INTEGRATIONS_GUIDE.md` and `docs/DEVELOPER_HANDOFF_ALPHA_1.0.md`.
7. Build APK as above; or copy APKs from external drive backup of `D:\auvora-build\dist\`.

---

## 11. Pre-delete checklist (do **not** skip)

Before deleting or reformatting this PC:

- [ ] Confirmed GitHub `main` = `3b87707…` (done this audit)
- [ ] Encrypted backup of root `.env`
- [ ] Backup of `apps/web/.env.local` (optional but present)
- [ ] Backup of `%USERPROFILE%\.config\alchemy\` if CLI wallets matter
- [ ] Copy needed APKs from `D:\auvora-build\dist\` to external drive
- [ ] Note: no release `key.properties` / `.jks` existed here to lose — create offline when going to Play Store
- [ ] Phone wallets: recovery phrases live on **devices**, not in this repo — ensure those are already backed up by the user securely

**Only after the checklist above:** it becomes reasonable to remove the local clone to free disk. Until then: **do not delete** the project or `D:\auvora-build\dist` if you still need those APKs.

---

## 12. Summary for migration

| Item                                               | Status           |
| -------------------------------------------------- | ---------------- |
| GitHub is authoritative for **source**             | **YES**          |
| Docs / tests / templates / scripts on GitHub       | **YES**          |
| Secrets / env / Alchemy keys / APKs on GitHub      | **NO** (correct) |
| Uncommitted work left behind                       | **NONE**         |
| Safe to delete local project without extra backups | **NO**           |
