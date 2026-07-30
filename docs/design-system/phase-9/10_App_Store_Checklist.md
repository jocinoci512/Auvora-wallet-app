# 10 — App Store Checklist

## Reality

Auvora today is a **Next.js web monorepo** (`apps/web`, `apps/admin`, `apps/docs`). There is **no iOS native app** under `apps/`.

## Checklist (all pending until wrapper exists)

| Item                                           | Status           |
| ---------------------------------------------- | ---------------- |
| App icon set (all sizes)                       | Not started      |
| Splash / launch screen                         | Not started      |
| Privacy nutrition / policy URL                 | Placeholder      |
| Permission strings                             | N/A until native |
| App name / subtitle                            | TBD              |
| Screenshots (6.7 / 6.5 / iPad)                 | Not started      |
| Review notes                                   | Not started      |
| Versioning / build number                      | Web semver only  |
| Capacitor / RN / TestFlight wrap of `apps/web` | Future           |

See also `docs/APP_STORE_RELEASE.md` (preparation only).

## Recommendation

Ship **web / PWA** first. Treat App Store as a follow-on program after live signing + legal URLs.
