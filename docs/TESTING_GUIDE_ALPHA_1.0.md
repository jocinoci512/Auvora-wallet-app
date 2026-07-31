# Testing Guide — Version 1.0 Alpha

**Version:** `1.0.0-alpha.1`  
**Purpose:** How to verify Alpha builds before cohort distribution.

---

## Automated (required before packaging)

### Mobile (`apps/mobile`)

```bat
set PATH=C:\Users\kwasi\flutter\bin;%PATH%
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
cd apps\mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --release
flutter build appbundle --release
```

Expect: analyze **No issues found**; all unit/widget tests **pass**.

### Web (`apps/web`)

```bat
pnpm --filter @auvora/web test
pnpm --filter @auvora/web typecheck
pnpm --filter @auvora/web lint
pnpm --filter @auvora/web build
```

Prefer Node **22.x** (engines). Node 24 may warn but can succeed.

### iOS

On **macOS** only:

```bash
cd apps/mobile
flutter build ipa --release
# or open ios/Runner.xcworkspace and Archive
```

---

## Manual UAT matrix (closed Alpha)

| #   | Journey                | Pass criteria                                    | Alpha notes              |
| --- | ---------------------- | ------------------------------------------------ | ------------------------ |
| 1   | Create wallet          | Wallet appears; PIN/biometric set                | Simulated rails          |
| 2   | Import wallet          | Restored balances/settings path works            | Use test mnemonic only   |
| 3   | Backup recovery phrase | Phrase shown once; confirm flow works            | Never photograph / share |
| 4   | Receive assets         | Screen explains lock; QR/copy/share **disabled** | Expected locked          |
| 5   | Send assets            | Preview completes; no live broadcast             | Kill switch off          |
| 6   | Swap                   | Quote UI completes without crash                 | Preview/demo quotes      |
| 7   | Bridge                 | Destination network shown; no live bridge        | Preview                  |
| 8   | Stake                  | Min amount enforced; preview only                | Preview                  |
| 9   | Connect Web3 dApp      | Approval sheet; permissions recorded             | Fail-closed when unsure  |
| 10  | Disconnect             | Session cleared; activity logged                 |                          |
| 11  | Security Center        | PIN / biometric / screenshot guard usable        |                          |
| 12  | Settings               | Appearance, privacy, notifications persist       | Crash toggle disabled    |
| 13  | Offline mode           | Cached portfolio/help readable                   |                          |
| 14  | Resume online          | Sync resumes; offline queue drains safe actions  |                          |
| 15  | Close / reopen         | Cold start restores secure lock + last state     |                          |

Mark any unexpected live broadcast, unlocked receive QR, or secret leakage as **Critical — block ship**.

---

## Security smoke checks

- Diagnostics export contains **no** mnemonic / PIN / private key fields
- Android backup disabled
- HTTPS-only network config present
- About links open privacy / terms / support without crashing

---

## Device coverage (minimum Alpha)

| Device class                       | Target                   |
| ---------------------------------- | ------------------------ |
| Android phone (API 29+)            | Sideload APK             |
| Android tablet (optional)          | Sideload APK             |
| iPhone (TestFlight when available) | macOS archive            |
| Web Chrome / Edge latest           | Production build preview |

---

## Reporting bugs

Use in-app **Send Alpha feedback** or email `alpha@auvora.app`.  
Never paste recovery phrases, private keys, or PINs.
