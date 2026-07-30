# Privacy Center

**Task:** 033  
**Route:** `/settings/privacy`  
**Component:** `PrivacyCenterExperience`  
**Storage:** `auvora_privacy_prefs_v1`

## Controls

| Control                  | Status                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| Analytics preferences    | Switch                                                                |
| Crash reporting          | Switch                                                                |
| Cookie preferences (web) | Essential locked on; analytics optional                               |
| Personalization          | Switch                                                                |
| Privacy policy access    | In-app draft: `/legal/privacy` (counsel must publish final before GA) |
| Terms of use             | In-app draft: `/legal/terms`                                          |
| Trust & transparency     | `/trust`                                                              |
| Data export              | Placeholder toast                                                     |
| Account deletion         | Confirmation placeholder                                              |

Preferences persist locally; no breaking API changes.

Related: [`docs/design-system/phase-10/`](./design-system/phase-10/) (company readiness), brand voice in `apps/web/src/lib/brand/voice.ts`.
