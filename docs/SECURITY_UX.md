# Security UX

**Tasks:** 029 (wallet PIN / lock) · 032 (Web3 / dApp security) · 033 (Security Center)

## Security Center (Task 033)

**Route:** `/settings`  
**Component:** `SecurityCenterExperience`  
See [`SECURITY_CENTER.md`](./SECURITY_CENTER.md) for score, devices, sessions, privacy, backup, and preferences.

## Wallet security (Task 029)

**Route:** `/security`  
**Component:** `SecurityExperience`  
**Storage:** `localStorage` key `auvora_security_prefs_v1` (preview)

### Features

| Feature                     | Status                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| PIN management              | Enable / disable; PIN hashed with SHA-256 (`hashPin`) — never stored plaintext |
| Auto-lock                   | Configurable idle minutes + Lock now                                           |
| Session timeout             | Separate extended-absence window                                               |
| Biometric placeholder       | Switch toggles `biometricEnabled` for future WebAuthn                          |
| Backup reminders            | Toggle + alert linking to recovery rehearsal                                   |
| Suspicious address warnings | Preference + Send-flow heuristics (`assessAddressRisk`)                        |

### Architecture notes

- Biometrics are intentionally a **placeholder** until platform authenticator wiring lands
- PIN hash is client-side for UX rehearsal; production should use server-assisted or WebAuthn
- Send experience surfaces risk reasons when destinations look like burn/null/placeholder addresses
- Create wallet sets `backupReminderEnabled` after successful creation

## Web3 / dApp security (Task 032)

Surfaced across `/web3`, browser, permissions, signing, and activity:

| Cue                              | Where                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Verified badge placeholder       | Hub cards (`ShieldCheck`)                                                              |
| Suspicious / insecure URL        | Browser address validation + warning alert                                             |
| Unknown contract warning         | Signing panel                                                                          |
| Permission risk indicators       | Hub + permission center chips                                                          |
| Phishing warning placeholders    | Activity security events + browser copy                                                |
| Domain verification architecture | Hub security panel (attestation wiring TBD)                                            |
| Notifications                    | Links to `/notifications` for connection / permission / tx / network / security alerts |

## Related surfaces

- `/wallets/recovery` — recovery rehearsal
- `/custody` — institutional keys / signing (unchanged)
- `/web3` — premium Web3 hub
- `/connections` — advanced connections lab

## Accessibility

- Lock screen is a full main landmark with password field
- Switches expose `aria-label`s
- Alerts announce preference updates
- Web3 risk chips and approve/reject controls are keyboard reachable
