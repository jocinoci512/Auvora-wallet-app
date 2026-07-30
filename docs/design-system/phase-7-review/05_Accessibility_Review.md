# 05 — Accessibility Review

## Verdict

**Pass with fixes** for Phase 7 surfaces.

## Issues found & fixed

| Issue                                       | Fix                                                    |
| ------------------------------------------- | ------------------------------------------------------ |
| `aria-live` on full chat panel              | Live region announces latest assistant line only       |
| Smooth scroll ignored reduce-motion         | Honors `prefers-reduced-motion` + `data-reduce-motion` |
| Education cards as links to unrelated pages | In-hub Read + lesson body; related link secondary      |
| Score ring                                  | Kept `aria-label`                                      |
| Severity jargon badges                      | Human-readable badge text                              |

## Checklist

| Area                          | Status                     |
| ----------------------------- | -------------------------- |
| Keyboard (chips, forms, Read) | Pass                       |
| Labels on search / ask        | Pass                       |
| Contrast (Aether tokens)      | Pass (inherits Phase 6 HC) |
| Motion                        | Pass after scroll fix      |
| Screen reader chat            | Improved                   |

## Follow-ups

- Name the chat scroll region for AT when threads grow long.
- Ensure CountUp respects reduce-motion (shared chart util — Phase 4 debt).
