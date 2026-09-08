# Auvora Wallet — iOS & Apple App Store Release Readiness

This pack documents the current iOS configuration, capabilities, permissions, and exact requirements for archiving and signing on macOS / CI.

---

## 1. Project Configuration & Metadata

- **Application Name**: Auvora Wallet (`CFBundleDisplayName`: `Auvora Wallet`)
- **Bundle Identifier**: `app.auvora.wallet` (`PRODUCT_BUNDLE_IDENTIFIER`)
- **Marketing Version**: `1.0.0-alpha.1` (`CFBundleShortVersionString`: `$(FLUTTER_BUILD_NAME)`)
- **Build Number**: `26` (`CFBundleVersion`: `$(FLUTTER_BUILD_NUMBER)`)
- **Flutter Framework Version**: `sdk: '>=3.5.0 <4.0.0'`
- **Target OS**: iOS 13.0+ / iPadOS 13.0+ (Universal iPhone/iPad)
- **Deep Links & Universal Schemes**:
  - `auvora://` (`auvora://wc`, `auvora://pair`, `auvora://sign`, `auvora://auth`, `auvora://tx`)
  - `wc://` (WalletConnect v2 dApp pairing requests)
  - `FlutterDeepLinkingEnabled: true`

---

## 2. Privacy & Permission Usage Strings (`Info.plist`)

All usage descriptions adhere to App Store Review Guideline 5.1.1 (Data Collection & Storage):

1. **Camera Usage (`NSCameraUsageDescription`)**:
   `"Auvora uses the camera only when you choose to scan an address QR code."`
   - Only triggered when explicitly tapping "Scan QR" in Send / WalletConnect pairing.
2. **Face ID / Biometrics (`NSFaceIDUsageDescription`)**:
   `"Auvora uses Face ID to unlock the app on this device. Biometric data stays on your phone."`
   - Backed by LocalAuthentication framework (`local_auth`).
3. **Export Compliance (`ITSAppUsesNonExemptEncryption`)**:
   `false`
   - Uses standard platform HTTPS (TLS) and standard common crypto libraries without proprietary non-exempt encryption.

### 2.1 App Store Privacy Nutrition Labels Declaration

When configuring the App Privacy questions in App Store Connect:

- **Data Used to Track You**: None (Auvora does not track users across third-party apps or websites).
- **Data Linked to You**:
  - **Contact Info**: Email address (for optional account registration, security alerts, and transactional email via Resend).
  - **Identifiers**: User ID and device ID (for authenticated session management and rate limiting).
  - **Sensitive Info / Identity Verification**:
    - _Processing_: Government identity documents and verification selfies are collected and processed by an authorized third-party processor (**Stripe Identity**) on Auvora's behalf for AML/CFT regulatory compliance and fraud prevention.
    - _Storage_: Raw document images and biometric templates are **never** stored on Auvora servers. Auvora stores external session references (`providerRef`), verification status, and AES-256 field-encrypted legal name and date of birth required for statutory compliance.
- **Diagnostics**: Crash data and performance metrics (collected via Sentry when configured; stripped of all credentials, private keys, and PII before transmission).
- **Data Retention & Account Deletion**:
  - Users can delete accounts in-app or via support.
  - Non-verified accounts are purged immediately.
  - Accounts with completed AML identity verifications are subject to mandatory statutory recordkeeping (typically 5 years post-account closure, subject to final owner/legal counsel determination).

---

## 3. Self-Custody Security Architecture

- **Private Keys & Seed Phrases**:
  - Stored strictly on-device in the iOS Keychain via `flutter_secure_storage` (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` / biometric-backed).
  - Private keys never touch any server or cloud backup.
  - Server-side signing is disabled.
- **Network Killswitches**:
  - `ReleaseConfig.liveBroadcastEnabled`: `false` (fail-safe preview mode).
  - `ReleaseConfig.allowFundingAddresses`: `true` (receive views locked/sandboxed).

---

## 4. macOS / CI Build & Submission Workflow

Because Apple requires Xcode on macOS for final codesigning and notarization, a macOS machine or Xcode Cloud / GitHub Actions macOS runner executes the following:

```bash
# 1. Check out repository
git clone https://github.com/jocinoci512/Auvora-wallet-app.git
cd Auvora-wallet-app/apps/mobile

# 2. Restore Flutter dependencies
flutter pub get

# 3. Install iOS CocoaPods
cd ios
pod install
cd ..

# 4. Build IPA / Archive for App Store
flutter build ipa --release \
  --build-name="1.0.0-alpha.1" \
  --build-number=26 \
  --export-options-plist=ExportOptions.plist

# 5. Upload to App Store Connect / TestFlight via xcrun altool or Fastlane:
xcrun altool --upload-app \
  -f build/ios/ipa/*.ipa \
  -t ios \
  -u "<apple-developer-id>" \
  -p "<app-specific-password>"
```

---

## 5. Owner-Required Actions (Apple Developer Portal)

The following items require human developer account ownership:

1. **Apple Developer Program Enrollment**: Active Organization or Individual account ($99/year).
2. **App Store Connect Record**: Create App record matching `app.auvora.wallet`.
3. **Distribution Certificate & Provisioning Profile**: Generated in developer.apple.com under Apple Worldwide Developer Relations.
4. **App Privacy Questionnaire**:
   - Contact Info (Email if cloud account created).
   - User Content / Identifiers (Device UUID, public wallet addresses).
   - No Financial Info collected server-side.
