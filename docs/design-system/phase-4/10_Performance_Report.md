# 10 — Performance Report

- CSS-only atmosphere; SVG charts (no heavy chart lib)
- Market fetch timeout 2.5s; demo first paint
- Sparklines generated client-side (cheap)
- Route already split via App Router

**Validation:** typecheck + lint PASS; production build on delivery.

Recommendations: virtualize asset lists >50; lazy NFT strip; measure Lighthouse on deploy.
