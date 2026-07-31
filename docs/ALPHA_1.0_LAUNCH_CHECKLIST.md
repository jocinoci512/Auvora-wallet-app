# Version 1.0 Alpha — Launch Checklist

**Goal:** Closed Alpha for trusted testers on simulated rails; structural readiness for _future_ App Store / Google Play work.  
**Version:** `1.0.0-alpha.1`  
**Not for:** Public Beta, live funding, or production store submission

---

## A. Closed Alpha go / no-go

- [x] `ReleaseConfig.releaseChannel = alpha` / `1.0.0-alpha.1`
- [x] `liveBroadcastEnabled = false`
- [x] `allowFundingAddresses = false` (Receive QR/copy/share off)
- [x] Crash reporting disabled / unwired messaging
- [x] About wired to Website / Privacy / Terms / Support
- [x] Tester brief: **do not send real funds**
- [x] Flutter analyze + test green on a Flutter-equipped host
- [x] Android Alpha APK + AAB built on this host (arm64 APK 41 MB · AAB 68.4 MB)
- [ ] Physical device sideload + UAT matrix completed by cohort lead
- [x] Web Alpha production build verified on this host
- [ ] Cohort list + feedback channel (`alpha@auvora.app` / in-app feedback)

**Alpha launch decision:** **READY FOR INTERNAL ALPHA TESTING** (simulated rails). Play/App Store production still blocked on keystore, hosted legal pages, and macOS iOS archive.

---

## B. Android packaging (before Play internal testing)

- [x] Application id / label / icons / splash
- [x] `network_security_config` cleartext disabled
- [x] Deep link intent filters (`auvora`, `wc`, HTTPS prefixes)
- [x] `key.properties.example` + gradle optional release signing
- [x] Minify **off** for Alpha
- [x] `flutter build apk --release` (arm64 sideload) verified this host
- [x] `flutter build appbundle --release` verified this host
- [x] Android notification channels created at cold start
- [ ] Create upload keystore; fill `apps/mobile/android/key.properties` (local only)
- [ ] Rebuild AAB with upload signing for Play Console
- [ ] Play Console app + Data safety + content rating
- [ ] Internal testing track upload
- [ ] Host `assetlinks.json` before enabling `autoVerify` App Links
- [ ] Sideload APK on at least one physical device and complete UAT matrix

---

## C. iOS packaging (macOS required)

- [x] Display name, usage strings, URL schemes, deep linking flag
- [x] `ITSAppUsesNonExemptEncryption=false`
- [x] `LSApplicationQueriesSchemes` for https/mailto
- [ ] Apple Developer App ID + certificates + profiles
- [ ] `flutter build ipa` / Xcode archive on macOS
- [ ] TestFlight internal group
- [ ] Privacy Nutrition Labels aligned with actual collection (crash/analytics off in Alpha)
- [ ] Associated Domains entitlement when Universal Links go live

---

## D. Web / legal hosting

- [x] Web version `1.0.0-alpha.1` + release config kill switches
- [x] Production build verified (this session)
- [ ] Publish Privacy + Terms at configured URLs (or update `ReleaseConfig`)
- [ ] Support mailbox monitored (`alpha@auvora.app`)
- [ ] Prefer Node 22.x for CI (engines); Node 24 warned but built OK here

---

## E. Security sign-off before any funding unlock

- [ ] Off-device HD address verification complete
- [ ] Policy decision to set `allowFundingAddresses = true`
- [ ] Live adapter audit + `liveBroadcastEnabled` flip
- [ ] Argon2id / residual High items from RC1 register
- [ ] Pen-test or equivalent for live rails

---

## F. Store production (future — not Alpha)

See also [`APP_STORE_RELEASE.md`](APP_STORE_RELEASE.md) and [`PUBLIC_LAUNCH_CHECKLIST.md`](PUBLIC_LAUNCH_CHECKLIST.md).

- [ ] Production signing (Play upload + Apple distribution)
- [ ] Store screenshots, description, age rating
- [ ] Public Privacy / Terms / support URLs live
- [ ] Kill switches re-evaluated under security sign-off
- [ ] Device + accessibility lab signed

---

## Tester brief (copy/paste)

1. This is **Version 1.0 Alpha** — preview rails only.
2. **Do not send real funds.** Receive QR/copy/share are locked.
3. Transfers do not broadcast live.
4. Report bugs via Alpha feedback; never paste recovery phrases.
5. Crash reporting is off — nothing is uploaded automatically.
