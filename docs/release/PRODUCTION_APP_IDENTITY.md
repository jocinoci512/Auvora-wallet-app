# Auvora Wallet — Permanent Production App Identity

Safe metadata only. **Never** commit keystores, `key.properties`, passwords, JWTs, or recovery phrases.

Machine-readable twin: [`apps/mobile/release/production-identity.json`](../../apps/mobile/release/production-identity.json).

## One customer application

| Platform                | Identity                           | Rule                                                            |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Android (Play / direct) | `com.auvora.auvora_wallet`         | **Never change.** Every update must supersede the same install. |
| Android QA              | `com.auvora.auvora_wallet.qa`      | Dev only — never publish as the customer app.                   |
| Android Staging         | `com.auvora.auvora_wallet.staging` | Dev only — never publish as the customer app.                   |
| iOS                     | `com.auvora.auvoraWallet`          | One permanent Bundle ID when Store-ready.                       |
| Windows                 | N/A                                | No mobile Windows target; companion is `apps/web`.              |

Store listing name: **Auvora Wallet**.

## Signing lineage (Android)

- Upload keystore stays local / CI secret store — **not** in git.
- Upload certificate SHA-256 (safe fingerprint):

  `1339d68fedc18b0638d6de73810f518e6b9ebab0629435ea3fbc55577d6da564`

- Do **not** generate a replacement production upload key without a deliberate Play Console migration.
- If Google Play App Signing is enabled later: keep this certificate as the **upload** key; Play holds the app-signing key.

## Version policy

- Current production `versionCode`: **30**
- Every superseding release: **strictly greater** (`31`, `32`, …)
- Never reuse a `versionCode` already shipped as a customer build
- `versionName`: professional semver; retire `-alpha` naming before public GA
- Canonical source: `apps/mobile/pubspec.yaml` → `version: X.Y.Z+CODE`

## In-place update contract

Updates (`Play`, `adb install -r`, TestFlight, etc.) with the **same** package/Bundle ID and **same** signing lineage must preserve:

- Encrypted vault / mnemonic material
- Auth session tokens (until natural expiry)
- Preferences, device fingerprint, recovery material
- Public addresses for ETH / BNB / Polygon / Solana / Bitcoin / Tron

An update must **never**:

- Create a second launcher icon / package
- Silently mint a replacement wallet
- Require recovery phrase or wallet re-import merely because the app version changed
- Point production builds at localhost / staging API

## Deep links (production)

- Custom: `auvora://` (`wc`, `pair`, `sign`, `auth`, `tx`), `wc:`
- HTTPS: `https://auvorawallet.com/wc`, `/connect` (+ `www.`)
- Future Digital Asset Links must list `com.auvora.auvora_wallet` + the upload/app-signing SHA-256

## Push

FCM is not enabled. When added, bind only to the production application ID / Bundle ID.

## Remote version policy

Clients may fetch `GET /api/v1/mobile/app-version-policy` (fail-open unless the server returns a hard minimum above the installed build).

Admin may adjust policy numbers only — **never** upload arbitrary mobile binaries through Admin.

## Guards

```bash
node scripts/qa/guard-production-mobile-release.mjs
```

Fails if production `applicationId` drifts, QA/staging is treated as production, `versionCode` did not increase vs locked baseline, production API points at forbidden hosts, signing fingerprint mismatches, or Mainnet broadcast flips on unexpectedly.

## Mainnet

**MAINNET BROADCAST: OFF** until explicit owner approval. Release guards enforce this.
