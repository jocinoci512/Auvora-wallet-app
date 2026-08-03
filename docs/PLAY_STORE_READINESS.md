# Google Play Closed Testing — Readiness

**Updated:** 2026-08-03  
**App:** Auvora Wallet · Version `1.0.0-alpha.1` · Channel Alpha  
**Target:** Closed testing track (not production/open)

---

## Go / no-go (honest)

| Gate                                                  | Status                                           |
| ----------------------------------------------------- | ------------------------------------------------ |
| Kill switches OFF (broadcast + funding)               | **PASS** (code + unit tests)                     |
| NFT absent from user IA                               | **PASS**                                         |
| Signed release AAB with upload keystore               | **FAIL** until `key.properties` present          |
| Canonical privacy / terms URLs live                   | **BLOCKED** — domain string drift + host content |
| Data safety / content rating / listing assets         | **INCOMPLETE**                                   |
| Device smoke (install, lock, send preview, WC refuse) | **DEVICE VERIFICATION REQUIRED**                 |
| Tester brief (preview balances, no real funds)        | **REQUIRED** before invites                      |

**Verdict:** Not ready to open Closed Testing until signing, legal URLs, and device smoke pass. Product code is Alpha-shaped and suitable _after_ those ops gates.

---

## Must-complete before Closed Testing

1. Create upload keystore; fill `apps/mobile/android/key.properties` (never commit).
2. Build `app-release.aab`; enroll Play App Signing.
3. Resolve canonical domain (`auvorawallet.com` vs `wallet.auvora.app`); publish `/legal/privacy` and `/legal/terms`.
4. Play Console: package name, content rating, Data safety (keys on-device; no seed upload; analytics off).
5. Store listing: short/full description matching Alpha — **preview balances, broadcast off, funding locked**.
6. Feature graphic + phone screenshots (see `docs/store-assets/alpha-1.0/`).
7. Closed testers list + email brief: do not send real crypto; report via `alpha@auvora.app`.
8. **DEVICE VERIFICATION REQUIRED:** cold start, PIN/biometric, receive lock, send preview, WC pairing refuse broadcast.

---

## Release build hygiene

| Check                   | Requirement                                           |
| ----------------------- | ----------------------------------------------------- |
| `liveBroadcastEnabled`  | Must remain `false`                                   |
| `allowFundingAddresses` | Must remain `false`                                   |
| Alchemy API key in APK  | **Do not** inject via `--dart-define` for Play builds |
| WC project id           | Public Reown project id only; never SMTP/JWT secrets  |
| `proguard` / minify     | Follow existing Android Gradle release config         |
| Cleartext traffic       | Disabled for release                                  |

---

## Data safety (draft claims — confirm with counsel)

- Crypto keys / recovery phrase: processed **on device**; not collected by Auvora servers for self-custody vault.
- Account email: collected for auth when cloud account used.
- Crash/analytics SDKs: currently unwired — do not claim collection you do not perform.
- Approximate location: not required for core wallet.

---

## Closed testing success criteria

- Install from Play Closed track on ≥2 physical Android devices.
- Create + import wallet; backup quiz; PIN; optional biometrics.
- Home shows preview labels; Receive locked; Send records preview only.
- Optional: Reown pair from web — signature OK, send refused.
- No crash loops on cold start / lock / unlock.

---

## Related

- [`docs/FINAL_PRODUCTION_READINESS_REPORT.md`](./FINAL_PRODUCTION_READINESS_REPORT.md)
- [`docs/KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md)
- [`apps/mobile/android/key.properties.example`](../apps/mobile/android/key.properties.example)
