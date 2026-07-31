# RC1 Accessibility Audit Report

**Build:** `1.1.0-rc.1` · 2026-07-31  
**Standard target:** WCAG 2.2 AA (oriented, not third-party certified)  
**Verdict:** **PARTIAL PASS** — good foundation; VoiceOver/TalkBack lab still open

---

## Strengths

| Area                | Status                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| Reduce motion       | Prefs + system `disableAnimations` honored on splash/send/home          |
| Text scale          | Accessibility settings + MediaQuery textScaler                          |
| High contrast       | Theme border/contrast boost                                             |
| Large touch targets | Button min height 52–56; chip padding raised in RC1                     |
| SoftBanner          | Semantics container + liveRegion (RC1)                                  |
| Receive lock UI     | Explicit semantics when funding locked                                  |
| Passcode entry      | Existing semantic structure                                             |
| Web                 | Some aria-labels; reduced-motion prefs; crash toggle disabled with aria |

---

## Gaps (KI-H02 / KI-M02)

- Full TalkBack / VoiceOver journey matrix not run on physical devices.
- Remaining hardcoded `AetherColors.muted` in some screens (dark contrast).
- Web money flows still rely partly on native browser dialogs.
- Localization still English-only (KI-M01) — impacts screen-reader language.

---

## RC1 changes

1. SoftBanner announced as Status/Warning/Error live regions
2. ChoiceChip `MaterialTapTargetSize.padded` + theme chip padding
3. Locked Receive affordances clearly labeled for assistive tech

---

## Recommendation

Ship RC1 for Closed Alpha with a11y feedback channel open. Schedule dedicated a11y lab before Public Beta.
