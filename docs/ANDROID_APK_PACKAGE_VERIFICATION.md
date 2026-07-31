# Android APK Package Verification

**Date:** 2026-07-31  
**Scope:** Final package verification of the Alpha 1.0.0 Android APK before physical device install.  
**Method:** Read-only inspection (`aapt dump badging/permissions/xmltree`, `apksigner verify --print-certs`, ZIP `lib/` inventory, `Get-Item`). No rebuild. No feature changes.

---

## Installability verdict

**YES** — The APK is a valid, signed release build that can be sideloaded onto physical phones that support **arm64-v8a** (virtually all modern Android phones) and run **Android 7.0 (API 24)+**.

**Caveats (non-blocking for Alpha sideload):**

- Signed with the **Android Debug** certificate (expected when `android/key.properties` is absent; documented Alpha fall-back).
- Flutter runtime (`libflutter.so` + `libapp.so`) is present only under **arm64-v8a**. Other ABI folders contain plugin `.so` files only and are **not** runnable Flutter ABIs. Prefer arm64 physical devices; exclude old 32-bit-only phones.

---

## Checklist results

| #   | Item                        | Result                                                                                                                                                           |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | APK location                | `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1-arm64.apk`                                                                                         |
| 2   | APK size                    | **42,955,865** bytes (**40.97 MB**); LastWriteTime 2026-07-31 12:49:17                                                                                           |
| 3   | Package / applicationId     | `com.auvora.auvora_wallet`                                                                                                                                       |
| 4   | Version name                | `1.0.0-alpha.1`                                                                                                                                                  |
| 5   | Version code                | `5`                                                                                                                                                              |
| 6   | Signing                     | **Debug** — `apksigner verify` exit 0. Cert DN: `C=US, O=Android, CN=Android Debug`. SHA-256: `4ccddc5af136206652c2e8cfeb6c9eae6d7231c5d290d79bb2efdf8e1be2da54` |
| 7   | minSdk                      | **24** (Android 7.0)                                                                                                                                             |
| 8   | targetSdk                   | **36**                                                                                                                                                           |
| 9   | Permissions                 | See below                                                                                                                                                        |
| 10  | Activities                  | See below                                                                                                                                                        |
| 11  | Deep links / intent filters | See below                                                                                                                                                        |
| 12  | Launch activity             | `com.auvora.auvora_wallet.MainActivity` (`MAIN` / `LAUNCHER`)                                                                                                    |
| 13  | ABI support                 | Declared `arm64-v8a`, `armeabi-v7a`, `x86_64`; **Flutter-runnable: arm64-v8a only**                                                                              |

### Same-size copies (not preferred for install)

- `D:\auvora-build\mobile-build\app\outputs\apk\release\app-release.apk`
- `D:\auvora-build\mobile-build\app\outputs\flutter-apk\app-release.apk`
- `C:\Users\kwasi\Projects\auvora-wallet\apps\mobile\build\app\outputs\...` (same size/timestamp)

**Prefer the dist artifact** at `D:\auvora-build\dist\alpha-1.0.0\`.

---

## Source consistency (read-only)

| Source                                     | Value                                                               | Matches APK?                                                |
| ------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/mobile/pubspec.yaml`                 | `1.0.0-alpha.1+5` → name `1.0.0-alpha.1`, code `5`                  | Yes                                                         |
| `apps/mobile/android/app/build.gradle.kts` | `applicationId = "com.auvora.auvora_wallet"`                        | Yes                                                         |
| Signing config                             | Release uses upload keystore if `key.properties` exists; else debug | Debug cert present → no upload keystore used for this build |

---

## Required permissions

From `aapt dump permissions`:

- `android.permission.INTERNET`
- `android.permission.CAMERA`
- `android.permission.USE_BIOMETRIC`
- `android.permission.USE_FINGERPRINT`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.ACCESS_NETWORK_STATE`
- `com.auvora.auvora_wallet.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (app-defined; also declared as a permission)

Camera is `uses-feature-not-required` (install not blocked on devices without a camera).

---

## Activities

| Activity                                              | Exported | Role                   |
| ----------------------------------------------------- | -------- | ---------------------- |
| `com.auvora.auvora_wallet.MainActivity`               | yes      | App entry + deep links |
| `io.flutter.plugins.urllauncher.WebViewActivity`      | no       | URL launcher helper    |
| `com.google.android.gms.common.api.GoogleApiActivity` | no       | Play services helper   |

---

## Deep links / intent filters (MainActivity)

| Scheme   | Host / path                             | Notes                                                                                 |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| `auvora` | `wc`, `sign`, `auth`, `tx`              | Custom app links                                                                      |
| `wc`     | (any)                                   | WalletConnect URI scheme                                                              |
| `https`  | `wallet.auvora.app` + `/wc`, `/connect` | App Links–style HTTPS filters (domain verification not required for sideload install) |

Launch filter: `android.intent.action.MAIN` + `android.intent.category.LAUNCHER`.

---

## ABI detail

| ABI folder in APK | `libflutter.so` | `libapp.so` | Runnable Flutter app? |
| ----------------- | --------------- | ----------- | --------------------- |
| `arm64-v8a`       | yes             | yes         | **Yes**               |
| `armeabi-v7a`     | no              | no          | No (plugin libs only) |
| `x86_64`          | no              | no          | No (plugin libs only) |

**Physical devices:** Install on **arm64** phones (almost all devices from ~2017 onward). Do not expect 32-bit-only (`armeabi-v7a`-only) devices to run this build.

---

## Signing notes

- `apksigner verify --print-certs` **succeeded** (exit 0).
- Certificate subject: `C=US, O=Android, CN=Android Debug`.
- `jarsigner -verify` may report “unsigned” because this APK uses modern APK Signature Scheme (v2+); **apksigner is authoritative**.
- Suitable for Alpha **sideload / USB install**. Not suitable for Play Store upload without a release/upload keystore.

---

## Fixes made

**None.** No installation blockers found; no rebuild performed.

---

## Physical phone install steps

### Option A — USB debugging (`adb`)

1. On the phone: **Settings → About phone →** tap **Build number** 7 times to enable Developer options.
2. **Settings → Developer options →** enable **USB debugging**.
3. Connect the phone to the PC with a USB cable; accept the RSA debugging prompt on the phone.
4. On the PC (PowerShell), confirm the device:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
   ```
5. Install the dist APK:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1-arm64.apk"
   ```
6. Launch **Auvora Wallet** from the app drawer.

### Option B — Sideload via file transfer

1. Copy `auvora-wallet-1.0.0-alpha.1-arm64.apk` to the phone (USB MTP, Google Drive, email, etc.).
2. On the phone, open **Files** (or your file manager) and tap the APK.
3. If prompted to allow unknown apps: **Settings → Apps → Special app access → Install unknown apps** (wording varies by OEM) → enable for **Files** / **Chrome** / the app used to open the APK.
4. Confirm install when Android shows the package installer.
5. Open **Auvora Wallet**.

### Confirm version after install

- On device: open the app and check any in-app About / version screen if present.
- Via adb:
  ```powershell
  & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell dumpsys package com.auvora.auvora_wallet | Select-String -Pattern "versionName|versionCode"
  ```
  Expect **versionName=`1.0.0-alpha.1`**, **versionCode=`5`**.

---

## Tools used

- Android SDK build-tools `36.0.0` at `%LOCALAPPDATA%\Android\Sdk\build-tools\36.0.0`
- `aapt dump badging`, `aapt dump permissions`, `aapt dump xmltree … AndroidManifest.xml`
- `apksigner verify --print-certs`
- PowerShell `Get-Item` + ZIP entry listing for `lib/`
