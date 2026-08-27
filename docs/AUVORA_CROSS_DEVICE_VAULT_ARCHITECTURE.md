# Auvora Cross-Device Vault Architecture (Phase 2)

**Status:** IMPLEMENTED (Phase 2)  
**Algorithm:** `auvora-vault-v1`  
**Package:** `@auvora/vault-crypto` (Node), mirrored in mobile (`vault_crypto.dart`) and web (`browser-envelope.ts`)

---

## Decision summary

| Option                                       | Verdict                                      |
| -------------------------------------------- | -------------------------------------------- |
| A. Client-side encrypted cloud vault         | **SELECTED**                                 |
| B. Threshold/MPC wallet                      | Deferred — operational cost + vendor lock-in |
| C. Passkey-assisted encrypted vault          | Future enhancement (second wrap key)         |
| D. Password-derived vault + recovery re-wrap | **SELECTED** (password path for daily use)   |
| E. Wallet-as-a-service / MPC infra           | Not integrated this phase                    |
| Custom crypto                                | **NO** — Argon2id + AES-256-GCM only         |

---

## Wire model

1. Client generates random **vault key** (32 bytes).
2. Client encrypts wallet bundle (mnemonics + metadata) with vault key (AES-256-GCM).
3. Client wraps vault key with:
   - **Password KEK** — Argon2id(account password, random salt)
   - **Recovery KEK** — Argon2id(normalized BIP39 phrase, separate salt)
4. Server stores **ciphertext + wrapped keys + salts + AAD** in `encrypted_vault_blobs`.
5. Server **never** receives plaintext mnemonic, seed, or private keys.

Associated data (AAD) binds: `algorithmId | ownerUserId | epoch`.

---

## Cross-device sign-in flow

1. User signs in with email + password (existing Auth).
2. Client `GET /api/v1/vault` → download envelope.
3. Client derives password KEK → unwrap vault key → decrypt bundle.
4. Client imports wallets into local device vault (SecureKeyStore / WebCrypto session).
5. Optional: mark device trusted + emit `auth.login.new_device` notification.

No manual “link wallet” or “sync public wallets” step on the happy path.

---

## Password reset behavior (explicit)

Account password reset **does not** decrypt the vault if the vault key was wrapped only with the old password.

| Scenario                              | Account access | Wallet access                                    |
| ------------------------------------- | -------------- | ------------------------------------------------ |
| Sign in on new device (same password) | Yes            | Yes — password unwrap works                      |
| Password reset via email              | Yes            | **Locked** until recovery phrase re-wrap         |
| Recovery phrase re-wrap               | Yes            | Yes — `rewrapVaultWithNewPassword()` client-side |

There is **no server-side decryption backdoor**.

---

## Security properties

- Server DB compromise → attacker gets ciphertext only (offline crack risk mitigated by Argon2id params).
- Tampered ciphertext → AEAD authentication fails closed.
- Cross-user access → JWT + `assertOwnerAccess` on vault API.
- Admin → cannot decrypt vault; no signing authority.
- IDOR → blocked on vault endpoints.

---

## Device management

- Existing `Device` / `Session` models + `/api/v1/me/devices|sessions`.
- New device login → email + in-app notification.
- Revoke device → sessions invalidated + notification event.

---

## Mainnet / broadcast

Mainnet broadcast remains **OFF**. Vault enables signing on activated devices; broadcast policy unchanged.
