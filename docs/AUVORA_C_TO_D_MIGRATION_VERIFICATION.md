# Auvora — C: → D: Migration Verification

**Date:** 2026-08-01  
**Constraint honored:** No re-copy, no deletes, no app/wallet/API/signing changes. Verification + dependency restore + Android rebuild only.

---

## Final verdict

# MIGRATION VERIFIED — D: CAN BECOME PRIMARY WORKSPACE

All required gates passed. **Do not delete C: until you manually approve.** Exact delete candidate is listed in §16.

---

## 1. Original C: path

`C:\Users\kwasi\Projects\auvora-wallet`

## 2. New D: path

`D:\auvora-wallet`

## 3. GitHub repository

https://github.com/jocinoci512/Auvora-wallet-app

## 4. Branch

`main` (tracks `origin/main`)

## 5. Commit hash

`6a12b025ba5a9fb91992bb808ef8501d7bbbe945`  
(`6a12b02` — docs: record offline migration backup pack location)

## 6. Git synchronization status

| Check                      | D: result                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| `.git` present             | YES                                                               |
| `git status`               | Clean; up to date with `origin/main`                              |
| Remote                     | `origin` → `https://github.com/jocinoci512/Auvora-wallet-app.git` |
| `HEAD` == `origin/main`    | **YES** (same hash)                                               |
| C: HEAD == D: HEAD         | **YES**                                                           |
| Tracked file count         | **2411** on both (identical `git ls-files`)                       |
| Dirty working tree (C / D) | **0 / 0**                                                         |
| Unexpected copy drift      | **None detected** for tracked source                              |

## 7. C:/D: comparison result

| Area                                                                        | Result                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Top-level names                                                             | Match (nothing only-on-C / only-on-D at root listing)  |
| `apps/`, `packages/`, `docs/`, `tools/`                                     | Present both                                           |
| Templates (`.env.example`, `key.properties.example`, mobile `.env.example`) | Present both                                           |
| Tracked sources                                                             | Identical set (2411 files)                             |
| Project size                                                                | C ≈ **8273.3 MB** · D ≈ **8273.4 MB** (near-identical) |

## 8. Local-only configuration status

| Item                                   | C:                                                          | D:                 |
| -------------------------------------- | ----------------------------------------------------------- | ------------------ |
| `.env`                                 | **PRESENT**                                                 | **PRESENT**        |
| `apps/web/.env.local`                  | **PRESENT**                                                 | **PRESENT**        |
| `apps/mobile/.env`                     | **NOT APPLICABLE** (never used; template is `.env.example`) | **NOT APPLICABLE** |
| `apps/mobile/android/key.properties`   | **NOT APPLICABLE** (missing both; example only)             | **NOT APPLICABLE** |
| `apps/mobile/android/local.properties` | **PRESENT**                                                 | **PRESENT**        |
| `.local-data`                          | **PRESENT**                                                 | **PRESENT**        |
| `apps/mobile/.env.example`             | **PRESENT**                                                 | **PRESENT**        |
| `key.properties.example`               | **PRESENT**                                                 | **PRESENT**        |

Secret **values** were not printed.

## 9. Flutter analyze result

From `D:\auvora-wallet\apps\mobile`:

- `flutter pub get` — **OK** (lockfile respected; no upgrades)
- `flutter analyze lib test` — **No issues found**

## 10. Test result

`flutter test` from D: — **108 tests passed**

## 11. Android build result

| Attempt                                        | Result                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| First (default TEMP on C:)                     | **FAILED** — CMake/Gradle failure; Flutter reported execution/permission symptoms while **C: had only ~4.2 GB free** |
| Second (`TEMP`/`TMP`/`GRADLE_USER_HOME` on D:) | **SUCCEEDED**                                                                                                        |

Generated APK:

`D:\auvora-wallet\apps\mobile\build\app\outputs\flutter-apk\app-release.apk` (~41.0 MB arm64 release)

Live broadcast / API / wallet configs were **not** changed.

**Operational note for D: as primary:** keep Gradle/temp on D: when C: is low on space, e.g.:

```bat
set GRADLE_USER_HOME=D:\auvora-build\gradle-home
set TEMP=D:\auvora-build\temp
set TMP=D:\auvora-build\temp
```

## 12. External Auvora directories

| Path                             | Status      | Notes                                                                                |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `D:\auvora-build\`               | **PRESENT** | Dist APKs, Gradle home, build cache — **outside** project folder                     |
| `D:\auvora-migration-backup\`    | **PRESENT** | Local-only secrets zip pack — **outside** project folder                             |
| `%USERPROFILE%\.config\alchemy\` | **PRESENT** | CLI auth + local wallet keys — **outside** project folder (under user profile on C:) |

Deleting **only** `C:\Users\kwasi\Projects\auvora-wallet` does **not** remove `D:\auvora-build`, `D:\auvora-migration-backup`, or `%USERPROFILE%\.config\alchemy\`.

## 13. C: project size

≈ **8273.3 MB** (~8.27 GB)

## 14. D: project size

≈ **8273.4 MB** (~8.27 GB)

## 15. Estimated recoverable storage

Deleting the old C: project folder recovers roughly **~8.3 GB** on C: (more if you also later purge disposable caches under that tree).

At verification time: **C: ~4.2 GB free** · **D: ~114 GB free**.

### Disposable (regenerable; not required for source truth)

- `node_modules/` (~0.9 GB each copy)
- `apps/mobile/build/`, `.dart_tool/`
- `D:\auvora-build\gradle-home` caches (regenerable)
- `.local-data` logs (optional; DB content may matter for local services)

## 16. Exact folder that can eventually be deleted

After you manually confirm Cursor opens `D:\auvora-wallet` as primary:

```text
C:\Users\kwasi\Projects\auvora-wallet
```

**This agent did not delete it.**

## 17. Anything that MUST remain

| Keep                             | Why                                              |
| -------------------------------- | ------------------------------------------------ |
| `D:\auvora-wallet`               | Primary source workspace                         |
| `D:\auvora-migration-backup\`    | Offline secrets/APK pack                         |
| `D:\auvora-build\`               | Build artifacts / Gradle home / recommended TEMP |
| `%USERPROFILE%\.config\alchemy\` | Alchemy CLI wallets/auth (not inside project)    |
| GitHub `main` @ `6a12b02…`       | Cloud source of truth                            |
| Phone recovery phrases           | On-device only — never in these folders          |

## 18. Gate checklist

| Gate                                      | Pass?                        |
| ----------------------------------------- | ---------------------------- |
| D: project opens / path valid             | ✓                            |
| Git works                                 | ✓                            |
| Correct GitHub remote                     | ✓                            |
| `main` matches `origin/main`              | ✓                            |
| Source complete vs C:                     | ✓                            |
| Required local config present             | ✓                            |
| Flutter dependencies                      | ✓                            |
| Flutter analyze                           | ✓                            |
| Tests                                     | ✓                            |
| Android build                             | ✓ (with TEMP on D:)          |
| No critical files only on C: project copy | ✓ (for project-scoped files) |

---

## Cursor workspace recommendation

Open folder: **`D:\auvora-wallet`**

Keep using Flutter at `C:\Users\kwasi\flutter` (or reinstall Flutter on D: later). Point Android SDK via `local.properties` as already present on D:.
