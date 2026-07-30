# 06 — Developer Experience Review

## Improvements from Phase 8 + follow-up

- Shared `section-nav.ts` for Ops / Infra / Identity / Support
- SDK methods for triage + maintenance end — UI and API stay aligned
- Labeled demos and honest subtitles reduce “why is this 401?” confusion
- Docs pack under `docs/design-system/phase-8/` and this review

## Still hard for new engineers

1. Admin app breadth (many domains, uneven polish)
2. Knowing which pages are live vs demo without reading banners
3. Local auth via paste-JWT (now labeled, still awkward)

## Recommendation

Keep a single “Admin surface matrix” in DX docs: route → live/demo → permission → primary API. Phase 8 README is the start; expand as support API lands.
