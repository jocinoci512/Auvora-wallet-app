# 04 — Global Readiness

## Stance

Auvora is **English-first** for production until language packs ship. Preferences already expose currency, language selectors, date/time formats, and accessibility — with honest roadmap copy that full i18n and RTL are future work.

## Checklist

| Area                  | Current                                             | GA requirement                              |
| --------------------- | --------------------------------------------------- | ------------------------------------------- |
| Localization strategy | Prefs + `locale-document`; partial language options | Message catalogs, QA per locale             |
| Date formats          | MDY / DMY / YMD prefs                               | Wire all surfaces to prefs                  |
| Time zones            | Device clock                                        | Document; avoid hard-coded zones in copy    |
| Currencies            | USD / EUR / GBP / JPY                               | Expand + FX disclosure                      |
| RTL                   | Not implemented                                     | `dir` + layout audit before Arabic/Hebrew   |
| Accessibility         | Reduce motion, high contrast, prior AA work         | Automated suite + AA claim only when earned |
| Legal notices         | Draft Privacy/Terms/Trust                           | Jurisdiction-specific counsel pages         |
| Regional settings     | Account + preferences                               | Geo disclosures where required              |

## Preferences UX

Settings → Appearance includes a **Regional & global** panel explaining device scope, English default, and Legal for counsel notices.

## Risks

- Showing language options without full translations misleads users — mitigate with roadmap honesty (done).
- Claiming “global launch” while English-only is marketing risk — Phase 10 launch plan sequences localization after P0 rails.

## Gate

**Global readiness: Conditional** — foundations present; full internationalization and RTL are **post–closed-beta** for true multi-region GA.
