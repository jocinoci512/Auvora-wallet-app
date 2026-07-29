# 01 — Security Center

**Surface:** `/settings/security` (`SecurityCenterExperience`)  
**PIN / lock:** `/security` (`SecurityExperience`) — linked from the Center

## Message

Your assets are protected, organized, and always under your control.

## Included

- Overall security score (conic ring)
- Health checklist with **why / current / how to improve**
- Recommended actions
- Sessions · devices · dApps · alerts KPIs
- Cards: devices, sessions, permissions, PIN/biometrics, recovery, hardware, trusted contacts (future), approval history
- Risk alerts + dismiss + link to notification prefs
- Live session/device/dApp summary when API available; demo fallback otherwise

## Code

- `components/settings/SecurityCenterExperience.tsx`
- `lib/settings/demo.ts` (`computeSecurityScore`)
- `lib/wallet-experience/security-prefs.ts`
