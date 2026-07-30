# Sprint 1 — Implementation Report

## Executive product review (post-hardening)

The board rejected “works” as the bar. Weaknesses found and **fixed in-sprint**:

| Issue                                   | Fix                                              |
| --------------------------------------- | ------------------------------------------------ |
| Returning users skipped unlock          | Passcode / biometrics **Unlock** gate            |
| Phrase generated before education       | Generate only after “Show my recovery phrase”    |
| Text-field PIN felt cheap               | 6-digit **pad + dots** with haptics              |
| Free-text verify was high friction      | **Word choice chips** (3 options)                |
| Clipboard copy encouraged unsafe backup | Removed copy; require **written acknowledgment** |
| Permissions forced attention            | Optional, collapsed; primary CTA is enter wallet |
| Splash felt slow                        | ~480ms (200ms reduced-motion)                    |
| Dashboard “Sprint 2” snackbars          | Calm **bottom sheets** — no engineering jargon   |
| No progress on long flow                | Step **n / 6** + progress bar                    |
| Welcome was three cards of clutter      | Brand-first single composition                   |
| System reduce-motion ignored            | Honors `MediaQuery.disableAnimations`            |
| Tablet layout unconstrained             | Max-width column on wide screens                 |

## What was built

### Native mobile (`apps/mobile` — Flutter)

1. Splash (fast, reduce-motion aware)
2. Welcome (create / import)
3. Create → explain → backup → chip verify
4. Import with live word-count helper
5. Security: passcode pad + optional biometrics
6. Optional permissions
7. Unlock gate for returning sessions
8. Dashboard: home, actions, empty activity, lock, remove device wallet

**No NFT surface.**

```bash
cd apps/mobile
flutter pub get
flutter test
flutter run
```

### Desktop companion

NFT product line removed / redirected; gateway NFT routes **410 Gone**.

## Sprint 2

Live balances & chain derivation, wire Send/Receive/Swap/Buy, archive `services/nft` + Prisma models, store assets.

## Board conclusion

Sprint 1 onboarding and foundation now meet a **premium self-custody** bar for first launch: clear, secure, calm, and honest about what’s not live yet. Money movement remains Sprint 2 — by design, not by neglect.
