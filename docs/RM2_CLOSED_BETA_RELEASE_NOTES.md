# Auvora Wallet — Closed Beta Release Notes

**Version:** 1.1.0-beta.1  
**Channel:** closed-beta  
**Milestone:** RM2

## Highlights

- Structured **Beta feedback** (bug, suggestion, confusing UX, performance, security, accessibility) with optional diagnostics consent
- **Funding receive locked** until BIP32 derivation ships — protects testers from irreversible mistakes
- **Live broadcast kill switch** remains off; preview transfers do not rewrite balances as confirmed
- Clipboard auto-clear, Android screenshot protection, and balance-reveal authentication
- Web access tokens stored in **sessionStorage** (no longer persisted in localStorage)

## Known limitations

- Addresses are preview-derived (not MetaMask/Phantom compatible)
- Chain broadcast is simulated
- PIN uses strengthened hash, not Argon2id yet
- Physical device / TalkBack / VoiceOver matrix still in progress

## How to report issues

Mobile: **More → Beta feedback** (or Help / About)  
Web: **Settings → Feedback**

Never include your recovery phrase in a report.
