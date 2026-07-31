# Developer Handoff — Version 1.0 Alpha

**Audience:** Engineers picking up Auvora after Prompt 10  
**Version:** `1.0.0-alpha.1`

---

## What shipped

Version 1.0 Alpha is a **closed-testing** package: production-shaped mobile/web configuration with hard kill switches so testers cannot fund or broadcast live transactions.

Primary surfaces:

| Area          | Path                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| Mobile app    | `apps/mobile`                                                                       |
| Web companion | `apps/web`                                                                          |
| Release gates | `apps/mobile/lib/release/release_config.dart`, `apps/web/src/lib/release/config.ts` |

---

## Tooling on Windows

1. Flutter stable (this host used `C:\Users\kwasi\flutter`, 3.44.8)
2. Android SDK (`%LOCALAPPDATA%\Android\Sdk`)
3. JDK 17 (`JAVA_HOME`)
4. Node 22.x preferred + pnpm 9

Invoke Flutter via `cmd.exe` if PowerShell mangles `flutter.bat`.

```bat
set PATH=C:\Users\kwasi\flutter\bin;%PATH%
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
```

---

## Kill switches (do not flip casually)

| Flag                    | Alpha value | Meaning                   |
| ----------------------- | ----------- | ------------------------- |
| `liveBroadcastEnabled`  | `false`     | No live chain broadcast   |
| `allowFundingAddresses` | `false`     | Receive QR/copy/share off |
| Crash SDK               | unwired     | Toggle disabled in UI     |

Unlock only after documented security sign-off (HD address verification + adapter audit).

---

## Signing

- Example: `apps/mobile/android/key.properties.example`
- Real file: `apps/mobile/android/key.properties` (**gitignored**)
- Without it, release builds **debug-sign** for sideload only

---

## Artifacts to produce

| Artifact | Command                                                                                  |
| -------- | ---------------------------------------------------------------------------------------- |
| APK      | `flutter build apk --release` → `build/app/outputs/flutter-apk/app-release.apk`          |
| AAB      | `flutter build appbundle --release` → `build/app/outputs/bundle/release/app-release.aab` |
| Web      | `pnpm --filter @auvora/web build` → `apps/web/.next`                                     |
| iOS      | macOS: `flutter build ipa`                                                               |

Suggested drop folder (local, not committed): `dist/alpha-1.0.0/`

---

## Docs map

| Doc                                                                    | Why                              |
| ---------------------------------------------------------------------- | -------------------------------- |
| [`MASTER_BUILD_PROMPT_10_REPORT.md`](MASTER_BUILD_PROMPT_10_REPORT.md) | Executive Prompt 10 verification |
| [`ALPHA_1.0_RELEASE_NOTES.md`](ALPHA_1.0_RELEASE_NOTES.md)             | Tester notes                     |
| [`ALPHA_1.0_LAUNCH_CHECKLIST.md`](ALPHA_1.0_LAUNCH_CHECKLIST.md)       | Go / no-go                       |
| [`STORE_READINESS_ALPHA_1.0.md`](STORE_READINESS_ALPHA_1.0.md)         | Store metadata gaps              |
| [`TESTING_GUIDE_ALPHA_1.0.md`](TESTING_GUIDE_ALPHA_1.0.md)             | Automate + UAT                   |
| [`CHANGELOG_ALPHA_1.0.md`](CHANGELOG_ALPHA_1.0.md)                     | Delta log                        |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                   | Platform architecture            |
| [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md)                         | Env / secrets                    |
| [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md)                               | Security posture                 |

---

## Next engineering priorities (1.1)

1. Branded iOS/Android icon & splash final assets
2. Upload keystore + Play internal track
3. macOS CI for iOS TestFlight
4. Host legal pages; enable App Links / Universal Links
5. Validate ProGuard and enable minify
6. Security sign-off → funding unlock → live broadcast behind staged flags
7. Crash / analytics SDK decision with privacy review
