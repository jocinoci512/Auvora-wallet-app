# Auvora Encrypted Cross-Device Security Design

**Status:** DESIGN ONLY — not implemented in this sprint  
**Date:** 2026-08-02  
**Scope:** Future encrypted restoration / sync of wallet secrets across trusted devices  
**Non-goals this sprint:** shipping sync, storing ciphertext of seeds on Auvora servers without a reviewed design, or claiming backup is live

---

## 1. Problem statement

Users want one Auvora account across web + multiple phones/tablets without pasting a seed into every device. Today:

- Mobile holds self-custody material in the on-device vault (PIN/biometrics).
- Web is a companion: account identity, public addresses, preferences, Reown pairing.
- **Encrypted wallet-secret sync is intentionally absent.**

This document defines a reviewable threat model and architecture for a future milestone.

---

## 2. Assets

| Asset                            | Sensitivity | Today                                       |
| -------------------------------- | ----------- | ------------------------------------------- |
| BIP39 mnemonic / seed            | Critical    | Device-local only                           |
| Derived private keys             | Critical    | Device-local only                           |
| Account password / JWT / refresh | High        | Auth service + httpOnly refresh             |
| Public addresses / labels        | Medium      | Account DB (WatchAddress, wallets metadata) |
| Preferences / sessions / devices | Medium      | Account DB                                  |
| Reown Project ID                 | Public      | Client-safe                                 |
| Reown Secret                     | Critical    | Must never ship to browser/APK              |
| Alchemy privileged API key       | Critical    | Server-only                                 |

---

## 3. Threat model

### 3.1 Adversaries

1. **Malicious or compromised Auvora server / insider** with DB + app access
2. **XSS / malicious extension** on web companion
3. **Stolen device** (unlocked or with weak PIN)
4. **Network MITM** on pairing / sync channels
5. **Phishing** (“paste your seed to sync”)
6. **Replay / session fixation** against sync enrollment
7. **Supply-chain** compromise of mobile/web builds

### 3.2 Required properties

- Server **cannot** decrypt wallet secrets at rest or in transit (zero-knowledge relative to seed).
- Sync enrollment requires **fresh proof** from an already-trusted device (or recovery ceremony with explicit user risk acceptance).
- Web browser **never** receives plaintext seed by default; if web vault is ever added, it must be optional, sandboxed, and separate.
- Revoking a device immediately blocks further ciphertext download for that device identity.
- No plaintext mnemonic/private key columns in Postgres/Redis/logs.

### 3.3 Explicit non-properties (honest)

- Encrypted cloud backup **cannot** protect a user who is phished into entering their seed on a fake site.
- If the user chooses a weak account password _and_ uses password-derived wrapping without a hardware second factor, offline brute force of ciphertext is a residual risk — mitigate with Argon2id params + optional hardware-bound keys.
- Availability: losing all devices + recovery material = funds unrecoverable (self-custody).

---

## 4. Proposed architecture (future)

```
[Trusted Device A — vault]
   | derive wrapping key (device secret + user secret + optional HW)
   | encrypt seed blob (AEAD)
   v
[Ciphertext blob + public metadata] ----HTTPS----> [Auvora Sync Store]
   ^                                              (userId, deviceId, blobId,
   |                                               epoch, wrappingHints,
   |                                               NO plaintext keys)
   |
[Trusted Device B]
   enroll via QR/proximity + account session + ownership challenge
   download ciphertext → unwrap only with user secret / recovery key
```

### 4.1 Components

1. **Account identity** (existing User/Session/Device) — authorization plane
2. **Device registry** — trusted devices with public keys for enrollment
3. **Sync vault store** — opaque AEAD ciphertext + versioning + audit
4. **Enrollment protocol** — QR/proximity between devices; short-lived enrollment token
5. **Recovery path** — optional Shamir / social recovery / paper recovery key (separate UX review)

### 4.2 Cryptography sketch (to be formalized)

- AEAD: XChaCha20-Poly1305 or AES-256-GCM
- KDF: Argon2id for password-derived wrapping keys
- Device key: platform secure enclave / Keystore where available
- Associated data: `userId || blobId || epoch || algorithmId`
- Never log nonces, keys, or plaintext

### 4.3 What servers may store

- Ciphertext, nonce, algorithm id, epoch, device public enrollment keys, timestamps, revocation flags
- Public addresses already registered

### 4.4 What servers must never store

- Mnemonic, seed, private keys, unwrapped wrapping keys, Reown Secret in client bundles, Alchemy keys in browser

---

## 5. Enrollment & revocation

1. Device A (has vault) creates enrollment QR containing one-time token + device pubkey fingerprint.
2. Device B signed into the same Auvora account scans QR; both prove account session + local auth.
3. A encrypts blob for B’s wrapping policy (or re-wraps under a shared recovery key).
4. Revoke device → delete/disable download grants; rotate epoch so old grants fail.

Web companion may initiate **account** enrollment UX but should not become the primary seed holder in Alpha.

---

## 6. Relationship to Reown / mobile signing

- Reown/WalletConnect remains the path for **web action → mobile approval** without moving keys.
- Encrypted sync is orthogonal: it restores a vault onto a new device; it does not replace WC signing.
- Live broadcast kill switch stays independent and OFF until explicit product sign-off.

---

## 7. Abuse cases & mitigations

| Abuse                                           | Mitigation                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Server silently re-encrypts for attacker device | Require attestation from existing trusted device; rate-limit enrollments; user-visible device list |
| Stolen refresh token enrolls attacker phone     | Step-up auth + recent unlock + optional email confirm                                              |
| User pastes seed into web “sync” form           | No such production form; education; block mnemonic-shaped payloads on public APIs                  |
| Replay of enrollment token                      | Single-use, short TTL, bind to device pubkey                                                       |
| Ciphertext exfil + offline crack                | Strong KDF, optional HW binding, breach monitoring                                                 |

---

## 8. Compliance with current invariants

| Invariant                      | Design stance |
| ------------------------------ | ------------- |
| No plaintext keys server-side  | Hold          |
| No private keys through Reown  | Hold          |
| No Alchemy key in browser      | Hold          |
| No Reown Secret in browser/APK | Hold          |
| NFT absent                     | Unaffected    |
| Live broadcast OFF             | Unaffected    |

---

## 9. Implementation gates (before any coding)

- [ ] External or internal security review of this design
- [ ] Explicit product decision on recovery UX (paper key vs social vs none)
- [ ] Threat model signed off
- [ ] Red-team of enrollment QR phishing
- [ ] Migration plan if algorithm changes
- [ ] Kill switch to disable sync downloads globally

**Until then: do not fake sync. Account/device/public-address layers remain the only cross-device product.**

---

## 10. References in current codebase

- Auth devices/sessions: `services/auth` + Prisma `User` / `Device` / `Session` / `RefreshToken`
- Public addresses: `WatchAddress`, `AddressOwnershipChallenge`, wallet-engine public import
- Mobile vault: `apps/mobile` local mnemonic storage + Reown WalletKit
- Web pairing: `apps/web/src/lib/reown/web-pairing.ts`
