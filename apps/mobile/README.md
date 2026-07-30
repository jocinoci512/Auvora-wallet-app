# Auvora Wallet — native mobile (Flutter)

Mobile-first product surface for iOS, Android, and tablet.  
Desktop companion remains `apps/web` (Next.js).

**Channel:** Closed Beta (`1.1.0-beta.1`) — preview chain rails; funding receive locked until BIP32 ships.

## Prerequisites

1. Flutter SDK 3.24+ (`flutter doctor`)
2. Xcode (macOS) / Android Studio SDK

Repo helpers (if present):

```powershell
.\.tools\flutter\bin\flutter.bat doctor
```

## Run

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Foundation (Prompt 1)

Splash → Welcome → Create / Import → Recovery verify → PIN + biometrics → Permissions → Home shell  
(Assets / Activity / More). Theme supports light and dark. Keys stay on-device via secure storage.

## Build

```bash
flutter test
flutter build apk --release   # Android
flutter build ios --release   # macOS + Xcode only
```

See `docs/MASTER_BUILD_PROMPT_1_REPORT.md` for the latest foundation milestone status.
