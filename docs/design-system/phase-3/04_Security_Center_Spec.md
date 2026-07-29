# 04 — Security Center Spec (Onboarding)

## Intent

Optional setup that **encourages** protection without blocking entry.

## Controls (onboarding)

| Control                | Behavior                               |
| ---------------------- | -------------------------------------- |
| Biometrics             | Sets `biometricEnabled`                |
| Auto-lock              | `autoLockMinutes` 5 or 0               |
| Encrypted cloud backup | UI preference (no plain phrase upload) |
| Device PIN             | Optional; `hashPin` + `pinEnabled`     |
| Security score         | Live 0–100 encouragement meter         |

## Persistence

`setSecurityPrefs` — `src/lib/wallet-experience/security-prefs.ts` (preserved)

## Tone

- Score copy: “Excellent start” / “A few toggles go a long way”
- Always offer **Skip for now**
- Never red-alert users for skipping optional steps

## Related surfaces

`/security` and Settings Security Center remain for post-onboarding management (consolidation still on Phase 1 roadmap).
