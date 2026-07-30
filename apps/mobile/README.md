# Auvora Wallet — native mobile (Flutter)

Mobile-first product surface for iOS, Android, and tablet.  
Desktop companion remains `apps/web` (Next.js).

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

## Sprint 1 scope

Splash → Welcome → Create / Import → Recovery verify → Security (PIN + biometrics) → Permissions → Dashboard.

Keys and recovery phrases stay on-device via secure storage. NFT features are intentionally absent.
