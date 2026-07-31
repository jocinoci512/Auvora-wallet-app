# Version 1.0 Alpha Manual Test Checklist

**Date:** 2026-07-31  
**Package:** `com.auvora.auvora_wallet`  
**Version:** `1.0.0-alpha.1` / versionCode `5`  
**APK (canonical):** `D:\auvora-build\dist\alpha-1.0.0\auvora-wallet-1.0.0-alpha.1-arm64.apk`  
**APK SHA-256:** `b6aeb67f1bf3f41f4c2b9be90462236277d15d812f988e40d2bdc6875cd087e9`

## Environment assumptions

- Physical **Android arm64-v8a** device (Flutter runtime in this APK is arm64-only)
- **Android 7.0 (API 24)+** (minSdk 24; targetSdk 36)
- Sideload / ADB install of **debug-signed** release APK (no Play upload keystore)
- Trusted internal Alpha cohort only — **no real funds**; preview / simulated rails
- Kill switches: `liveBroadcastEnabled=false`, `allowFundingAddresses=false`
- Crash / analytics SDKs **unwired**; notifications are local (no push SDK)
- WalletConnect / deep links may be **partial**; fail-closed is a Pass when messaging is clear

## How to use

- Mark **Pass / Fail / Blocked / N/A** in the Pass/Fail column.
- Use **Notes** for device quirks, screenshots, and bug IDs.
- Expected Result already encodes Alpha-safe / locked behavior — do not Fail solely because live funding/broadcast is unavailable.
- **Critical ship blockers:** unexpected live broadcast, unlocked Receive QR/copy/share, or secret leakage in diagnostics/feedback.

## 1. Installation

| ID      | Test Case                                                                                                                                                                                                                      | Expected Result                                                                                                                                      | Pass/Fail | Notes |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| INST-01 | Sideload canonical APK via file transfer<br>1. Copy auvora-wallet-1.0.0-alpha.1-arm64.apk from dist folder to phone.<br>2. Open file in Files/Chrome; allow Install unknown apps if prompted.<br>3. Confirm package installer. | Installer shows Auvora Wallet / com.auvora.auvora_wallet. Install completes without package parse errors. App icon appears in launcher.              | ☐         |       |
| INST-02 | Install via ADB (USB debugging)<br>1. Enable Developer options + USB debugging.<br>2. adb devices shows device authorized.<br>3. adb install -r the dist APK path.                                                             | adb reports Success. Package com.auvora.auvora_wallet is installed/updated.                                                                          | ☐         |       |
| INST-03 | Confirm versionName and versionCode<br>1. After install, run dumpsys package filter for versionName/versionCode OR open in-app About.                                                                                          | versionName=1.0.0-alpha.1 and versionCode=5. About shows Version 1.0 Alpha / 1.0.0-alpha.1 / channel alpha.                                          | ☐         |       |
| INST-04 | Cold launch after install<br>1. Force-stop if needed; tap app icon from launcher.<br>2. Observe splash → first screen.                                                                                                         | App launches to splash then onboarding or unlock without crash. No immediate ANR dialog.                                                             | ☐         |       |
| INST-05 | Debug-signing awareness<br>1. Note any Play Protect / unknown-developer warnings during or after install.<br>2. Confirm install still proceeds when user accepts.                                                              | Debug-signed APK may trigger warnings (expected for Alpha; no upload keystore). Warnings do not prevent install on tester device after user consent. | ☐         |       |
| INST-06 | arm64 device compatibility gate<br>1. Confirm device CPU is arm64-v8a (About phone / adb getprop ro.product.cpu.abi).<br>2. Install and launch.                                                                                | App runs on arm64. Do not Pass on 32-bit-only devices — Flutter runtime is arm64-only in this APK (other ABI folders lack libflutter.so).            | ☐         |       |
| INST-07 | minSdk / OS floor<br>1. Confirm Android version ≥ 7.0 (API 24).<br>2. Attempt install on supported device.                                                                                                                     | Install succeeds on API 24+. Package declares minSdk 24 / targetSdk 36.                                                                              | ☐         |       |
| INST-08 | Reinstall / upgrade path<br>1. Install APK once; create a throwaway wallet if prompted.<br>2. adb install -r same APK again.<br>3. Relaunch.                                                                                   | Upgrade install succeeds. App opens without wipe unless user cleared data. No duplicate-package conflict.                                            | ☐         |       |
| INST-09 | Uninstall hygiene<br>1. Uninstall from system settings.<br>2. Confirm package gone (adb shell pm list packages \| findstr auvora).                                                                                             | Package removed. Reinstall presents fresh onboarding (local wallet data cleared with uninstall).                                                     | ☐         |       |

## 2. Onboarding

| ID     | Test Case                                                                                                                                | Expected Result                                                                                                                                                              | Pass/Fail | Notes |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| ONB-01 | First-run welcome / intro<br>1. Fresh install; launch app.<br>2. Walk through any intro / welcome screens.                               | Onboarding screens render; CTAs for Create and Import (or equivalent) are visible and tappable. No blank/frozen first frame after splash.                                    | ☐         |       |
| ONB-02 | Alpha honesty messaging early<br>1. During onboarding or About accessible from early flow, look for Alpha / funding / preview messaging. | User can discover that this is Version 1.0 Alpha with locked funding / preview transfers (About and/or banners). Copy does not claim live production funding.                | ☐         |       |
| ONB-03 | Create vs Import entry points<br>1. From onboarding home, tap Create wallet path then back.<br>2. Tap Import / Restore path then back.   | Both journeys are reachable; Back returns without corrupting first-run state.                                                                                                | ☐         |       |
| ONB-04 | Skip / incomplete onboarding resilience<br>1. Start create flow; press system Back repeatedly to exit mid-flow.<br>2. Relaunch app.      | App recovers to a coherent onboarding or partial-setup state without crash. No orphan unlocked wallet without PIN if flow aborted before security setup completes.           | ☐         |       |
| ONB-05 | Permissions prompts timing<br>1. Complete onboarding until first camera/biometric/notification prompt appears (or note absence).         | Camera/biometric/notification permissions are requested in context (scanner / biometrics / notifs), not as unexplained barrage on first paint. Deny path does not crash app. | ☐         |       |

## 3. Wallet Creation

| ID    | Test Case                                                                                                                                                                                  | Expected Result                                                                                                                                       | Pass/Fail | Notes |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| WC-01 | Happy path — create new wallet<br>1. Choose Create wallet.<br>2. Follow mnemonic display / confirmation if shown.<br>3. Set PIN (and optional biometrics).<br>4. Land on Home / Portfolio. | Wallet is created; Home shows portfolio (preview balances OK). Secure lock is active on next cold start.                                              | ☐         |       |
| WC-02 | Recovery phrase shown during create<br>1. In create flow, reach phrase reveal step.<br>2. Confirm phrase is shown as 12/24 words as designed.                                              | Phrase displays once in create/backup path; UI warns not to screenshot/share. Words are readable and order preserved for copy-to-paper.               | ☐         |       |
| WC-03 | Phrase confirmation challenge<br>1. At verify step, intentionally select wrong words.<br>2. Then complete with correct words.                                                              | Wrong selection blocks progress with clear error. Correct selection continues to PIN/security setup.                                                  | ☐         |       |
| WC-04 | PIN required before Home<br>1. Attempt to finish create without setting PIN if UI allows skip.<br>2. Otherwise complete PIN setup.                                                         | Wallet cannot be left fully unlocked without intended security setup. PIN (or documented equivalent) is established before sensitive Home use.        | ☐         |       |
| WC-05 | Multi-chain addresses derived (preview)<br>1. After create, open Receive / Account / More and note address presentation.                                                                   | Addresses appear for derivation preview but are redacted and funding-locked (allowFundingAddresses=false). Full QR/copy for funding remains disabled. | ☐         |       |
| WC-06 | Second create attempt blocked or controlled<br>1. With an existing wallet, try to create another from settings/onboarding entry if exposed.                                                | App either guides to add-account flow, warns, or prevents accidental wipe. Existing wallet remains accessible after cancel.                           | ☐         |       |

## 4. Wallet Import

| ID    | Test Case                                                                                                                                             | Expected Result                                                                                                                 | Pass/Fail | Notes |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| WI-01 | Import valid test mnemonic<br>1. Choose Import / Restore.<br>2. Enter a known TEST-ONLY mnemonic (never production funds).<br>3. Set PIN; reach Home. | Import succeeds; wallet unlocks to Home. Preview portfolio/activity load without crash.                                         | ☐         |       |
| WI-02 | Reject invalid mnemonic<br>1. Enter gibberish / wrong word count / invalid checksum words.<br>2. Submit.                                              | Clear validation error; import does not proceed. App does not crash.                                                            | ☐         |       |
| WI-03 | Partial paste / whitespace handling<br>1. Paste mnemonic with extra spaces or line breaks.<br>2. Submit.                                              | App normalizes or clearly rejects. Successful path only when words are valid.                                                   | ☐         |       |
| WI-04 | Import then lock/unlock<br>1. Complete import + PIN.<br>2. Kill app; relaunch; unlock with PIN.                                                       | Imported wallet persists; unlock restores same account context.                                                                 | ☐         |       |
| WI-05 | Funding lock after import<br>1. After import, open Receive.                                                                                           | Same Alpha lock as create: funding locked message; QR/copy/share disabled; addresses redacted. Tester must not send real funds. | ☐         |       |

## 5. Portfolio

| ID      | Test Case                                                                                                                                               | Expected Result                                                                                                     | Pass/Fail | Notes |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| PORT-01 | Home portfolio renders<br>1. Unlock to Home.<br>2. Observe total value, asset list, recent activity.                                                    | Portfolio UI loads. Preview/simulated balances are acceptable for Alpha; no crash or endless spinner without error. | ☐         |       |
| PORT-02 | Pull-to-refresh / sync<br>1. Pull to refresh (or use refresh control).<br>2. Wait for completion.                                                       | Refresh completes; UI returns to idle. Errors surface as banner/snackbar, not silent hang.                          | ☐         |       |
| PORT-03 | Open asset from list<br>1. Tap an asset row.                                                                                                            | Navigates to Asset Details without crash.                                                                           | ☐         |       |
| PORT-04 | Activity / transaction list<br>1. Open Activity / recent transactions from Home.<br>2. Tap a transaction if any exist (or create a preview send first). | List scrolls; empty state is clear if no txs. Detail opens for selected tx.                                         | ☐         |       |
| PORT-05 | Search / filter if present<br>1. Use portfolio search or network filter if UI provides it.<br>2. Clear filter.                                          | Filtering updates list; clear restores full list. No crash on empty results.                                        | ☐         |       |

## 6. Asset Details

| ID    | Test Case                                                                                                                | Expected Result                                                                                                                                      | Pass/Fail | Notes |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| AD-01 | Asset detail happy path<br>1. Open any asset from portfolio.<br>2. Review balance, network, actions (Send/Receive/etc.). | Detail screen shows asset identity and actions. Balance may be preview data.                                                                         | ☐         |       |
| AD-02 | Copy address locked on detail<br>1. Locate Copy address control on asset detail.                                         | Control is disabled or labeled locked (e.g. Copy address (locked)). Tapping does not copy a fundable full address while allowFundingAddresses=false. | ☐         |       |
| AD-03 | Navigate to Send from asset<br>1. Tap Send on asset detail.                                                              | Send flow opens pre-scoped to that asset (or asset selectable). Preview rails only.                                                                  | ☐         |       |
| AD-04 | Navigate to Receive from asset<br>1. Tap Receive on asset detail.                                                        | Receive opens with Alpha funding-lock messaging; QR/copy/share remain off.                                                                           | ☐         |       |

## 7. Send

| ID      | Test Case                                                                                                                                                              | Expected Result                                                                                                                                                                                                        | Pass/Fail | Notes |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| SEND-01 | Preview send happy path<br>1. Open Send; pick asset; enter valid recipient format and amount under balance.<br>2. Review; confirm / authorize preview.                 | Flow completes as on-device preview. User sees broadcast-off / preview messaging (liveBroadcastEnabled=false). No real chain broadcast.                                                                                | ☐         |       |
| SEND-02 | Insufficient balance validation<br>1. Enter amount larger than available balance.<br>2. Attempt continue.                                                              | Clear validation blocks submit. No crash.                                                                                                                                                                              | ☐         |       |
| SEND-03 | Invalid recipient address<br>1. Enter malformed address.<br>2. Attempt continue.                                                                                       | Address validation error shown; send cannot complete.                                                                                                                                                                  | ☐         |       |
| SEND-04 | Zero / empty amount<br>1. Leave amount empty or 0.<br>2. Attempt continue.                                                                                             | Blocked with clear error.                                                                                                                                                                                              | ☐         |       |
| SEND-05 | Cancel mid-flow<br>1. Fill form; press Back / Cancel before authorize.                                                                                                 | Returns safely; no partial broadcast side effects. Portfolio unchanged inappropriately.                                                                                                                                | ☐         |       |
| SEND-06 | Preview result & activity entry<br>1. Complete a preview send.<br>2. Open transaction detail from Activity.                                                            | Tx appears as preview/recorded locally. Detail shows banner that explorer may not show preview transfer / live broadcast off.                                                                                          | ☐         |       |
| SEND-07 | Balances not depleted as live when broadcast off<br>1. Note asset balance before preview send.<br>2. Complete preview send of non-zero amount.<br>3. Re-check balance. | With liveBroadcastEnabled=false, portfolio balances are not treated as live-chain debited (local snapshot may prepend preview tx without live balance mutation). Behavior matches preview rails — not a live transfer. | ☐         |       |
| SEND-08 | Address book recipient pick (if available)<br>1. From Send, open address book / recent recipient.<br>2. Select prior address; continue.                                | Recipient field populates; flow continues to preview confirm without crash.                                                                                                                                            | ☐         |       |

## 8. Receive

| ID      | Test Case                                                                               | Expected Result                                                                                                                                     | Pass/Fail | Notes |
| ------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| RECV-01 | Funding lock banner<br>1. Open Receive from Home or asset.                              | Screen states funding is locked for Version 1.0 Alpha; addresses exist for derivation preview but QR, copy, and share stay off.                     | ☐         |       |
| RECV-02 | QR disabled<br>1. Look for QR code display / generate control.                          | Funding QR is not shown as a scannable fundable QR (or is clearly disabled). Tester cannot obtain a usable funding QR.                              | ☐         |       |
| RECV-03 | Copy disabled<br>1. Attempt Copy address.                                               | Copy is disabled or non-functional for funding. Full fundable address is not placed on clipboard.                                                   | ☐         |       |
| RECV-04 | Share disabled<br>1. Attempt Share address.                                             | Share is disabled. No system share sheet with full funding address.                                                                                 | ☐         |       |
| RECV-05 | Redacted address display<br>1. Observe displayed address string.                        | Address is redacted (e.g. 0x1234…abcd style) per ReleaseConfig.redactAddress while funding locked. fundingBlockedMessage text present or reachable. | ☐         |       |
| RECV-06 | Network / asset switch still locked<br>1. Switch receive network or asset if UI allows. | Lock persists across networks/assets. No path unlocks QR/copy/share in Alpha.                                                                       | ☐         |       |

## 9. QR Scanner

| ID    | Test Case                                                                                                                                                 | Expected Result                                                                              | Pass/Fail | Notes |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------- | ----- |
| QR-01 | Open scanner and camera permission<br>1. Open QR scanner from Send or dedicated entry.<br>2. Allow camera when prompted.                                  | Camera preview starts (or clear denied state). Permission declared; deny does not crash.     | ☐         |       |
| QR-02 | Deny camera permission<br>1. Deny camera.<br>2. Observe UI guidance.                                                                                      | Friendly empty/error state with path to Settings. App remains usable elsewhere.              | ☐         |       |
| QR-03 | Scan valid address / payment QR (test fixture)<br>1. Point at a test QR encoding a valid address format.<br>2. Confirm handoff into Send recipient field. | Scanner parses and routes into send/connect flow as designed. No crash on successful decode. | ☐         |       |
| QR-04 | Scan garbage / non-wallet QR<br>1. Scan a random non-crypto QR (e.g. website).                                                                            | Clear unsupported/invalid message; scanner remains open or exits gracefully.                 | ☐         |       |

## 10. Buy

| ID     | Test Case                                                                                                | Expected Result                                                                                                      | Pass/Fail | Notes |
| ------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| BUY-01 | Open Buy flow<br>1. Navigate to Buy from Home / More / Digital assets.                                   | Buy UI opens with simulated/preview providers. Alpha may show KYC hook-only messaging — not a live purchase.         | ☐         |       |
| BUY-02 | Quote / amount entry<br>1. Select asset and enter fiat/crypto amount.<br>2. Request quote if applicable. | Quote UI returns preview quote or clear unavailable state. No real payment processor charge.                         | ☐         |       |
| BUY-03 | Authorize preview only<br>1. Proceed to confirm; complete Authorize preview if shown.                    | Completion is preview/simulated. liveBroadcastEnabled remains off — no live on-chain funding of wallet from partner. | ☐         |       |
| BUY-04 | Cancel Buy mid-flow<br>1. Start Buy; cancel before authorize.                                            | Exits cleanly; no pending live order.                                                                                | ☐         |       |
| BUY-05 | KYC honesty<br>1. Look for KYC / partner identity messaging in Buy.                                      | Copy indicates Alpha shows KYC hook only / partners not live — aligns with simulated providers.                      | ☐         |       |

## 11. Sell

| ID      | Test Case                                                                | Expected Result                                                                               | Pass/Fail | Notes |
| ------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------- | ----- |
| SELL-01 | Open Sell flow<br>1. Navigate to Sell.                                   | Sell UI opens on preview rails. Destination may note preview until off-ramp partners connect. | ☐         |       |
| SELL-02 | Preview sell quote<br>1. Select asset/amount; continue to quote/review.  | Preview quote shown; irreversible warnings may appear. No live off-ramp payout.               | ☐         |       |
| SELL-03 | Authorize preview sell<br>1. Complete Authorize preview.                 | Local/preview completion only. Broadcast kill switch remains off.                             | ☐         |       |
| SELL-04 | Validation — oversize amount<br>1. Enter amount above available balance. | Blocked with validation error.                                                                | ☐         |       |

## 12. Swap

| ID      | Test Case                                                                                                          | Expected Result                                                                     | Pass/Fail | Notes |
| ------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------- | ----- |
| SWAP-01 | Open Swap and select pair<br>1. Open Swap.<br>2. Choose from/to assets.                                            | Swap UI loads; pair selection works. Quotes are preview/demo.                       | ☐         |       |
| SWAP-02 | Receive quote<br>1. Enter amount; wait for quote.                                                                  | Quote appears or explicit failure. No crash on quote refresh.                       | ☐         |       |
| SWAP-03 | Authorize preview swap<br>1. Confirm swap via Authorize preview.                                                   | Completes as preview; liveBroadcastEnabled=false — no live DEX settlement expected. | ☐         |       |
| SWAP-04 | Same-asset / invalid pair handling<br>1. Attempt identical from/to if UI allows.<br>2. Or clear amount and submit. | Validation prevents nonsensical swap; clear messaging.                              | ☐         |       |
| SWAP-05 | Flip / reverse pair control<br>1. Use swap direction toggle if present.                                            | Assets invert; quote recalculates or resets cleanly.                                | ☐         |       |

## 13. Bridge

| ID      | Test Case                                                                                | Expected Result                                                                         | Pass/Fail | Notes |
| ------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- | ----- |
| BRDG-01 | Open Bridge flow<br>1. Navigate to Bridge.<br>2. Select source and destination networks. | Bridge UI shows destination network selection. Preview only — no live bridge execution. | ☐         |       |
| BRDG-02 | Preview bridge quote<br>1. Enter amount; request quote.                                  | Preview quote or clear unavailable state. No funds leave device rails.                  | ☐         |       |
| BRDG-03 | Authorize preview bridge<br>1. Confirm with Authorize preview.                           | Preview completion only; broadcast kill switch off.                                     | ☐         |       |
| BRDG-04 | Same-network negative case<br>1. Set source = destination network if UI allows.          | Validation blocks or explains invalid bridge path.                                      | ☐         |       |

## 14. Stake

| ID     | Test Case                                                                                   | Expected Result                                                                      | Pass/Fail | Notes |
| ------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ----- |
| STK-01 | Open Stake / pools<br>1. Navigate to Stake.<br>2. Browse available pools.                   | Pools list renders (preview). Min stake rules visible or enforced later.             | ☐         |       |
| STK-02 | Below minimum stake rejected<br>1. Enter amount below pool minimum.<br>2. Attempt continue. | Min amount enforced with clear error. No preview authorize until valid.              | ☐         |       |
| STK-03 | Authorize preview stake<br>1. Enter valid amount ≥ minimum.<br>2. Authorize preview.        | Preview stake only; no live validator deposit. Rewards copy may say preview history. | ☐         |       |
| STK-04 | Claim / unstake preview paths<br>1. If claim/unstake actions exist, open them.              | Actions describe preview behavior; authorize remains preview. No live broadcast.     | ☐         |       |

## 15. Security Center

| ID     | Test Case                                                                                                                      | Expected Result                                                                                                                                       | Pass/Fail | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| SEC-01 | Open Security Center<br>1. Navigate Settings → Security Center (or equivalent).                                                | Security Center loads with PIN, biometrics, and related controls accessible.                                                                          | ☐         |       |
| SEC-02 | Screenshot / privacy guard (Android)<br>1. Enable screenshot guard if present.<br>2. Attempt screenshot on a sensitive screen. | On Android, FLAG_SECURE path may block or blacken screenshots when enabled. Toggle persists. (iOS guard known limited — N/A if testing Android only.) | ☐         |       |
| SEC-03 | Trusted devices list (local)<br>1. Open Trusted devices if listed.                                                             | On-device list loads (local, not cloud attestation). Empty or current device shown without crash.                                                     | ☐         |       |
| SEC-04 | Permission Center entry<br>1. Open Permission Center from Security / Settings.                                                 | Permissions UI lists app/dApp permissions; editable without crash.                                                                                    | ☐         |       |
| SEC-05 | Lock now / require unlock<br>1. Use Lock / Require authentication control if present.<br>2. Confirm unlock gate appears.       | App locks; PIN/biometric required to return to Home.                                                                                                  | ☐         |       |

## 16. Recovery Phrase

| ID    | Test Case                                                                                                                        | Expected Result                                                                                                 | Pass/Fail | Notes |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| RP-01 | View backup phrase with auth<br>1. Open Backup / Recovery phrase.<br>2. Authenticate with PIN/biometric.                         | Phrase revealed only after auth. Warning not to photograph/share is visible.                                    | ☐         |       |
| RP-02 | Auth failure blocks reveal<br>1. Enter wrong PIN at reveal gate.                                                                 | Phrase remains hidden; error shown. Lockout rules apply after repeated failures (see PIN section).              | ☐         |       |
| RP-03 | Verify backup flow<br>1. Complete verify/confirm words flow after viewing.                                                       | Successful verify marks backup acknowledged if product tracks it. Wrong words fail closed.                      | ☐         |       |
| RP-04 | Background app while phrase visible<br>1. Reveal phrase; press Home; return to app.                                              | Prefer re-auth or obscure phrase on resume. No crash; phrase not left casually visible if design hides it.      | ☐         |       |
| RP-05 | Diagnostics exclude mnemonic<br>1. Export/copy Alpha diagnostics or feedback payload if available.<br>2. Inspect for seed words. | Diagnostics/feedback contain no mnemonic, private keys, or PIN. May include kill-switch flags and version only. | ☐         |       |

## 17. Biometrics

| ID     | Test Case                                                                                                    | Expected Result                                                         | Pass/Fail | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------- | ----- |
| BIO-01 | Enable biometrics<br>1. In Security, enable Fingerprint/Face unlock.<br>2. Complete system biometric prompt. | Biometrics enable succeeds when hardware enrolled. Preference persists. | ☐         |       |
| BIO-02 | Unlock with biometrics<br>1. Lock app / cold start.<br>2. Unlock via biometric.                              | Successful biometric unlock reaches Home. Fallback to PIN is offered.   | ☐         |       |
| BIO-03 | Biometric failure / cancel<br>1. Cancel biometric prompt or fail recognition.<br>2. Use PIN fallback.        | Cancel/fail does not crash; PIN unlock still works.                     | ☐         |       |
| BIO-04 | Disable biometrics<br>1. Turn off biometric unlock.<br>2. Relaunch and unlock.                               | Only PIN (or configured method) is required. Setting persists.          | ☐         |       |

## 18. PIN

| ID     | Test Case                                                                                                     | Expected Result                                                                                                                         | Pass/Fail | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| PIN-01 | Set / change PIN<br>1. Change PIN in Security Center.<br>2. Confirm old PIN if required; set new; re-confirm. | PIN updates; unlock with new PIN works; old PIN fails.                                                                                  | ☐         |       |
| PIN-02 | Wrong PIN rejection<br>1. On lock screen, enter incorrect PIN once.                                           | Clear error; remains locked. No indication of partial correctness beyond fail.                                                          | ☐         |       |
| PIN-03 | Lockout after repeated failures<br>1. Enter wrong PIN repeatedly until lockout.                               | Temporary lockout or backoff engages with clear messaging. App does not wipe wallet unexpectedly in Alpha without explicit wipe action. | ☐         |       |
| PIN-04 | PIN mismatch on setup<br>1. During set/change, enter mismatched confirmation.                                 | Mismatch error; PIN not changed.                                                                                                        | ☐         |       |
| PIN-05 | App resume lock<br>1. Background app beyond lock timeout (or use Lock now).<br>2. Resume.                     | Unlock gate appears per security settings before sensitive content.                                                                     | ☐         |       |

## 19. Settings

| ID     | Test Case                                                                                                                        | Expected Result                                                                                                                                                                                                                | Pass/Fail | Notes |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----- |
| SET-01 | Settings home navigation<br>1. Open More/Settings.<br>2. Open Appearance, Networks, Account, Privacy, About in turn.             | Each subsection opens and Back returns to Settings. No crash.                                                                                                                                                                  | ☐         |       |
| SET-02 | Appearance persistence<br>1. Change theme (light/dark/system) if available.<br>2. Kill and relaunch.                             | Theme preference persists.                                                                                                                                                                                                     | ☐         |       |
| SET-03 | Privacy — analytics unwired honesty<br>1. Open Privacy settings.<br>2. Inspect analytics toggle/copy.                            | Copy states analytics unavailable / no analytics SDK wired; nothing leaves device. Toggle does not silently exfiltrate.                                                                                                        | ☐         |       |
| SET-04 | Privacy — crash reporting unwired<br>1. Inspect crash reporting preference.                                                      | States not available in Alpha; preference local only; no crash SDK wired.                                                                                                                                                      | ☐         |       |
| SET-05 | About — version and legal links<br>1. Open About.<br>2. Confirm version label; tap Website / Privacy / Terms / Support email.    | Shows Version 1.0 Alpha, 1.0.0-alpha.1, channel alpha, fundingBlockedMessage. Links attempt to open wallet.auvora.app URLs / mailto:alpha@auvora.app (hosted pages may 404 until published — note result; app must not crash). | ☐         |       |
| SET-06 | Alpha feedback<br>1. Open Send Alpha feedback.<br>2. Compose note; copy/export if offered.<br>3. Confirm payload has no secrets. | Feedback stays on-device until user copies. Includes version/channel/kill-switch flags only — no seed/PIN/keys.                                                                                                                | ☐         |       |
| SET-07 | Account settings funding lock<br>1. Open Account settings; view address controls.                                                | Funding lock banner; redacted address; copy/export disabled while allowFundingAddresses=false.                                                                                                                                 | ☐         |       |

## 20. Notifications

| ID       | Test Case                                                                                                                              | Expected Result                                                                                      | Pass/Fail | Notes |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- | ----- |
| NOTIF-01 | Notification preference center<br>1. Open Notifications settings.<br>2. Toggle categories if present.                                  | Preferences save locally. No push SDK — remote push not expected in Alpha.                           | ☐         |       |
| NOTIF-02 | OS permission (Android 13+)<br>1. If prompted for POST_NOTIFICATIONS, Allow once.<br>2. Deny on a second install/profile if available. | Allow/deny handled without crash. Channels exist in system App notifications for the package.        | ☐         |       |
| NOTIF-03 | In-app notification center<br>1. Open in-app notifications / inbox if present.                                                         | List or empty state renders. Local categories only — not a live FCM test.                            | ☐         |       |
| NOTIF-04 | No unexpected remote spam<br>1. Idle online 5 minutes after install with notifications allowed.                                        | No unexpected marketing push (push not configured). Local notifs only if triggered by in-app events. | ☐         |       |

## 21. Web3 Connections

| ID    | Test Case                                                                                                                                                                     | Expected Result                                                                                                                                                                                    | Pass/Fail | Notes |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| W3-01 | Open Connections / Web3 hub<br>1. Navigate to Connections / Web3.                                                                                                             | Hub loads; empty state or existing sessions listed. Partial WalletConnect implementation is acceptable if fail-closed.                                                                             | ☐         |       |
| W3-02 | Approve connection sheet (preview)<br>1. Initiate a test connect via wc: deep link or in-app connect if available.<br>2. Review permissions on approval sheet.<br>3. Approve. | Approval sheet shows requested permissions. Session recorded in Permission Center when approve succeeds. Fail-closed if provider uncertain — Pass if clear deny/error rather than silent grant.    | ☐         |       |
| W3-03 | Reject connection<br>1. Start connect; tap Reject/Cancel.                                                                                                                     | No session created; activity may log rejection. App stable.                                                                                                                                        | ☐         |       |
| W3-04 | Signing sheet preview<br>1. If a connected session can request sign (or use auvora://sign deep link test), open signing UI.<br>2. Review and reject.                          | Signing sheet shows readable request summary. Reject works. Live broadcast remains off — no unexpected chain submit.                                                                               | ☐         |       |
| W3-05 | Disconnect session<br>1. From Connections, disconnect an approved session.                                                                                                    | Session cleared; permissions updated; activity logged if designed.                                                                                                                                 | ☐         |       |
| W3-06 | Deep link schemes<br>1. From adb or browser, trigger auvora://wc or wc: test URI (harmless/invalid OK).<br>2. Observe app open.                                               | App opens via intent filter (schemes auvora, wc; https wallet.auvora.app paths declared). Invalid payload fails closed without crash. Note: HTTPS App Links not autoVerify — may need app chooser. | ☐         |       |

## 22. Offline Mode

| ID     | Test Case                                                                                                                            | Expected Result                                                                                                                                                | Pass/Fail | Notes |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| OFF-01 | Cached portfolio while offline<br>1. Load portfolio online.<br>2. Enable Airplane mode.<br>3. Browse Home / Help.                    | Cached portfolio/help readable. Offline indicator or graceful degradation — not a hard crash.                                                                  | ☐         |       |
| OFF-02 | Blocked online-only actions<br>1. While offline, attempt Swap quote or refresh that needs network.                                   | Clear offline error; unsafe actions not silently marked live-success. OfflineActionQueue only queues safe actions.                                             | ☐         |       |
| OFF-03 | Resume online sync<br>1. Disable Airplane mode.<br>2. Return to app; refresh.                                                        | Sync resumes; safe queued actions drain if any. UI returns to online state.                                                                                    | ☐         |       |
| OFF-04 | No OS background sync expectation<br>1. Leave app killed offline overnight (optional short wait).<br>2. Note freshness on next open. | Background OS sync not wired (KI-M06). Stale-until-foreground is acceptable for Alpha — Pass if documented behavior, Fail only if claims real-time BG updates. | ☐         |       |

## 23. Performance

| ID      | Test Case                                                                                                      | Expected Result                                                                                                                               | Pass/Fail | Notes |
| ------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| PERF-01 | Cold start timing<br>1. Force-stop app.<br>2. Launch from icon; time to interactive unlock/Home.               | Reaches interactive UI without ANR (Android “App isn’t responding”). Splash completes in a reasonable Alpha window on mid-range arm64 device. | ☐         |       |
| PERF-02 | Portfolio scroll smoothness<br>1. On Home with asset list, fling-scroll repeatedly 20s.                        | No sustained freeze/ANR. Occasional jank OK for Alpha; hard freeze is Fail.                                                                   | ☐         |       |
| PERF-03 | Rapid tab switching<br>1. Switch bottom tabs / primary nav quickly for 30s.                                    | No crash, blank screens lasting >few seconds, or ANR.                                                                                         | ☐         |       |
| PERF-04 | Memory after long session (smoke)<br>1. Navigate Send/Receive/Swap/Settings for ~5 minutes.<br>2. Return Home. | App remains responsive. No progressive degradation to unusable state.                                                                         | ☐         |       |

## 24. Accessibility

| ID      | Test Case                                                                                                                      | Expected Result                                                                                                                                                   | Pass/Fail | Notes |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| A11Y-01 | TalkBack basic navigation<br>1. Enable TalkBack.<br>2. Swipe through Home, Settings, Send entry.                               | Focus moves logically; primary controls have readable labels. Blocking unlabeled icon-only controls are Fail for those controls.                                  | ☐         |       |
| A11Y-02 | TalkBack lock / PIN entry<br>1. With TalkBack on, unlock with PIN.                                                             | PIN pad announced adequately to complete unlock. No expose of PIN digits via insecure announcements beyond standard keypad behavior.                              | ☐         |       |
| A11Y-03 | Large font / display size<br>1. Set system font to largest.<br>2. Visit Home, Receive lock banner, Settings.                   | Critical text remains readable; no irreversible overlap hiding primary CTAs. Minor clip acceptable if noted.                                                      | ☐         |       |
| A11Y-04 | Contrast smoke (manual)<br>1. In light and dark theme (if both exist), check primary text on backgrounds for Home and banners. | Body text and lock banners remain legible. Flag severe low-contrast failures; known residual a11y debt (KI-H02) may be Notes, not automatic Fail unless unusable. | ☐         |       |
| A11Y-05 | Touch target smoke<br>1. Tap primary nav items and Send/Receive CTAs with finger (not stylus).                                 | Primary actions are reliably hittable (~48dp class). Overlapping hit targets that mis-fire are Fail.                                                              | ☐         |       |

## 25. Crash Recovery

| ID    | Test Case                                                                                                                     | Expected Result                                                                                                                      | Pass/Fail | Notes |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----- |
| CR-01 | Force-stop and relaunch<br>1. Unlock app; note wallet visible.<br>2. Android Settings → Force stop.<br>3. Launch app; unlock. | App cold-starts; unlock required; wallet data retained (same account).                                                               | ☐         |       |
| CR-02 | Kill during Send preview<br>1. Start Send; reach review; Force stop.<br>2. Relaunch; unlock; check Activity/balances.         | No corrupted state. No falsely claimed live broadcast. Preview tx either absent or consistently recorded — not half-applied secrets. | ☐         |       |
| CR-03 | OS reboot retention<br>1. Reboot phone.<br>2. Launch Auvora; unlock.                                                          | Wallet still present; PIN/biometric still work. Settings preferences retained.                                                       | ☐         |       |
| CR-04 | Low-memory reclaim smoke<br>1. Open Auvora; switch to heavy apps to encourage reclaim.<br>2. Return via recents or launcher.  | Either restores UI state or cleanly re-locks and reloads. No crash loop on resume.                                                   | ☐         |       |

---

## Sign-off

| Field                                      | Value |
| ------------------------------------------ | ----- |
| Tester                                     |       |
| Device model                               |       |
| Android version                            |       |
| Date                                       |       |
| Build hash / APK filename                  |       |
| Overall result (Pass / Fail / Conditional) |       |
| Critical blockers found (Y/N + IDs)        |       |
| Signature / acknowledgement                |       |

_Total test cases: 127_
