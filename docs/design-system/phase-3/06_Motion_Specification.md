# 06 — Motion Specification (Onboarding)

Aligned with Phase 1 `07_Motion_System.md`.

| Moment          | Motion                              | Reduced motion     |
| --------------- | ----------------------------------- | ------------------ |
| Step body enter | 450ms fade + 10px rise (`ob-enter`) | Instant            |
| Progress bar    | Width ease 450ms                    | Instant jump       |
| Welcome orbit   | Soft float 5s loop                  | Static             |
| Creating        | Spinner ring                        | Static ring + copy |
| Success         | Scale-pop check 550ms               | Instant show       |
| Path hover      | 2px lift                            | Color/border only  |
| Button press    | scale 0.98                          | Optional           |

## Haptics

Where supported (future native shell): light impact on success and verification pass only — never on errors spam.

## Rules

- No confetti
- No continuous neon pulses
- Loading never blocks without status text
- Step transitions replace, not stack, previous panel
