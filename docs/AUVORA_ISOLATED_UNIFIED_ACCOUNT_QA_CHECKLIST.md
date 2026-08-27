# Auvora Isolated Unified Account — Physical QA Checklist

**Status:** Manual steps for the owner  
**Do not** use real funds · **Do not** enable mainnet · **Do not** clear `com.auvora.auvora_wallet`

## Preconditions

1. Docker Desktop installed and running
2. `powershell -File scripts/qa/start-local-unified-qa.ps1` succeeded
3. Local services healthy (gateway `:4000`, auth, wallet, compliance, notifications)
4. Local Web `:3000` and Admin `:3001` load
5. `artifacts/auvora-qa-debug.apk` installed as **Auvora QA** (`com.auvora.auvora_wallet.qa`)
6. Original **Auvora Wallet** still installed and untouched
7. Phone connected: `adb devices` shows SM-S918U
8. `adb reverse tcp:4000 tcp:4000` (and `:3000` if opening verify links on phone)

## TEST 1 — Android → Web

1. Open **Auvora QA** (not the production Auvora Wallet app)
2. Create Account → email + password → verify email (check inbox / Mailpit / console)
3. Confirm Admin → Users shows the new user
4. Create / initialize wallet on device
5. Confirm Admin → Wallets shows **public** metadata only
6. Confirm no primary **Sync public wallets** button
7. On desktop Web (localhost): Sign In with same email/password
8. Confirm same user id, KYC status, public addresses
9. Activate device / decrypt vault with account password
10. Confirm same public address — **do not** display mnemonic

## TEST 2 — Web → Android

1. Create a second QA account on Web
2. Verify email → initialize wallet / upload vault
3. Sign into Auvora QA Android with same credentials
4. Confirm same user + wallet public identity
5. No account linking step

## TEST 3 — Devices

1. After both platforms signed in, open Trusted Devices on Web and Security on Android
2. Both devices listed
3. Revoke one session
4. Confirm revoked client loses API access
5. Confirm email + in-app notification

## TEST 4 — Notifications

1. Trigger KYC or device event
2. Same notification on Android + Web backend inbox

## TEST 5 — KYC

1. Submit QA KYC (simulator path)
2. Admin approve → both clients VERIFIED + email/notification
3. Separate rejection with customer-visible reason → reason visible; internal note never shown

## TEST 6 — $5k / $10k (prepare only)

Use testnet prepare endpoints / UI amounts — **no broadcast** unless explicitly requested later.

| Amount    | Expect                     |
| --------- | -------------------------- |
| $4,999.99 | no KYC gate from threshold |
| $5,000    | KYC required               |
| $9,999.99 | KYC only                   |
| $10,000   | KYC + Admin review pending |

Reject with reason → email/clients show reason. Approve another — still no broadcast in this pass.

## Deposits

Do **not** send Sepolia funds in this pass.

## After QA

Report results. Only then consider push / staged deploy. Production remains untouched.
