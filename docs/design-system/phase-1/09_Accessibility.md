# 09 — Accessibility

**Standard:** WCAG 2.2 **AA** (target), with AAA for critical amount text where practical  
**System:** Aether Accessibility

---

## Commitment

Auvora moves real value. Inaccessible UI is a **trust defect**, not a polish item.

Every component in `06_Component_Library.md` must ship with:

- Keyboard path
- Name / role / value for assistive tech
- Visible focus
- Reduced-motion alternative
- Contrast-safe tokens

---

## Perceivable

| Requirement        | Aether rule                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| Color contrast     | Body ≥4.5:1; large text ≥3:1; see `04_Color_System.md`                 |
| Color independence | Status uses icon + text, not color alone                               |
| Text resize        | Usable at 200% zoom without clipping primary actions                   |
| Images / NFT media | Meaningful `alt`; decorative `alt=""`                                  |
| Charts             | Text summary + `aria-label`; data table alternative for complex charts |

---

## Operable

| Requirement    | Aether rule                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Keyboard       | All actions reachable; no keyboard traps; dialogs trap focus intentionally and restore on close |
| Focus visible  | `lumen` ring always for `:focus-visible`                                                        |
| Touch targets  | ≥44×44 px; spacing ≥8px between adjacent targets                                                |
| Pointer cancel | Press-outside / Esc cancels non-committed sheets                                                |
| Motion         | Honor `prefers-reduced-motion` (see `07_Motion_System.md`)                                      |
| Shortcuts      | Desktop shortcuts documented; don’t override assistive tech chords                              |

---

## Understandable

| Requirement    | Aether rule                                            |
| -------------- | ------------------------------------------------------ |
| Language       | `lang` on document; consistent labels                  |
| Labels         | Every input has a visible label (placeholder ≠ label)  |
| Errors         | Identified in text; associated with `aria-describedby` |
| Confirmations  | Explicit verb + object; fees readable by SR before CTA |
| Consistent nav | Same destinations in same relative order across pages  |

---

## Robust

| Requirement  | Aether rule                                                       |
| ------------ | ----------------------------------------------------------------- |
| Semantics    | Native elements preferred (`button`, `a`, `input`) over div roles |
| ARIA         | Only when native semantics insufficient; no contradictory roles   |
| Live regions | Polite for status toasts; assertive for money-critical failures   |
| Tables       | Real table markup for tabular data on desktop                     |

---

## Wallet-specific risks

1. **Address truncation** — SR should access full value via copy control or expandable disclosure
2. **QR receive** — Provide address text alternative always
3. **Signature requests** — Summarize intent; don’t rely on monospace blobs alone
4. **Network mismatch warnings** — Must be announced, not color-only banners
5. **Timed sessions** — Warn before logout; allow extension when safe

---

## Modes

| Mode           | Behavior                                                   |
| -------------- | ---------------------------------------------------------- |
| Default        | Aether light/dark                                          |
| High contrast  | Stronger borders, boosted muted text, reduced translucency |
| Reduced motion | No slide/scale/shimmer loops; 80ms fades max               |
| Increased text | Layouts flex; bottom nav may reflow labels under icons     |

---

## Testing protocol (required before UX launch of redesigned surfaces)

1. Keyboard-only walkthrough of Send, Swap, Connect
2. VoiceOver (iOS/Safari) + TalkBack smoke on Home, Send, Confirm
3. axe or equivalent automated scan on redesigned templates
4. Windows High Contrast / forced-colors smoke
5. 200% zoom check on Home and ConfirmSheet

---

## Known gaps in current product (audit input)

Documented further in `11_UI_Audit.md` / `12_UX_Audit.md`:

- Possible duplicate `main` landmarks on dashboard
- Pill links styled as tabs without full tab keyboard model
- Muted text opacity patterns that may dip under AA on translucent surfaces
- Dense nav hit areas
- High-contrast token exists but wiring is unclear

These are remediation inputs for Phase 2+, not excuses.
