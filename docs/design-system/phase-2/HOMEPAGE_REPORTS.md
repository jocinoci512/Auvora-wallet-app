# Phase 2 — Homepage delivery reports

**Surface:** `apps/web` `/` marketing homepage (Aether)  
**App dashboard:** moved to `/dashboard` (routing preserved; former home dashboard retained)  
**Design source of truth:** `docs/design-system/phase-1/*`

---

## 1. Homepage Audit

| Criterion                         | Status | Notes                                                                                        |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Complete redesign (not a refresh) | Pass   | New `MarketingHome` + `marketing-home.css`; dashboard no longer on `/`                       |
| Hero impresses / brand-first      | Pass   | Syne “Auvora”, vision headline, single lede, CTAs, live wallet preview                       |
| No stock photography              | Pass   | Original SVG device UI + initial avatars                                                     |
| Social proof                      | Pass   | Trust strip + proof grid + animated counters                                                 |
| Features (10)                     | Pass   | Multi-chain, swaps, portfolio, NFTs, staking, prices, security, biometrics, backup, hardware |
| Product showcase                  | Pass   | Interactive preview + portfolio/swap/NFT modes                                               |
| Security section                  | Pass   | Six plain-language pillars                                                                   |
| Why Auvora                        | Pass   | Frustration → relief cards (not competitor logos)                                            |
| Networks (10)                     | Pass   | BTC→Tron set as specified                                                                    |
| Testimonials carousel             | Pass   | 3 quotes, dots, prev/next, auto-advance (respects reduced motion)                            |
| FAQ accordion                     | Pass   | Keyboard + ARIA expanded/controls                                                            |
| Final CTA                         | Pass   | One message, one primary button                                                              |
| Routing maintained                | Pass   | `/` marketing; `/dashboard` app; nav App link                                                |
| SEO metadata                      | Pass   | Title template, description, OG/Twitter, robots, themeColor Mist/Obsidian                    |
| Mega-nav hidden on home           | Pass   | Marketing nav chrome only                                                                    |

**Verdict:** Homepage meets Phase 2 structural brief and Aether identity.

---

## 2. Performance Report

| Topic               | Assessment                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Build               | `@auvora/web` production build **PASS**                                                                        |
| Code splitting      | Homepage is a client island; route-level CSS via `page.tsx` import                                             |
| Images              | No raster hero images — SVG/CSS device mock (no decode cost)                                                   |
| Fonts               | `next/font` Syne, Manrope, Source Serif 4, IBM Plex Mono — `display: swap`, subset latin                       |
| Motion              | `IntersectionObserver` one-shot reveals; intervals cleared; reduced-motion disables loops                      |
| Lazy load           | Below-fold content is in DOM (marketing SSR/CSR hybrid); further dynamic `import()` possible as follow-up      |
| Lighthouse goal 95+ | **Not measured in CI this pass** — architecture is Lighthouse-friendly; run PageSpeed on deploy URL to confirm |

**Recommendations:** dynamic-import FAQ/testimonials; defer wallet preview balance jitter until in view; consider RSC shell + client islands split in Phase 2.1.

---

## 3. Accessibility Report

| Requirement       | Status                                                 |
| ----------------- | ------------------------------------------------------ |
| Skip link         | Pass (layout)                                          |
| Landmarks         | Pass (`main.mh`, sections labelled, footer nav)        |
| Focus visible     | Pass (`lumen` outlines on buttons/links/tabs)          |
| Touch targets     | Pass (≥40–48px controls; footer links 44px)            |
| Keyboard FAQ      | Pass (`aria-expanded`, `aria-controls`, regions)       |
| Testimonials      | Pass (`aria-live="polite"`, tablist dots)              |
| Reduced motion    | Pass (reveals instant; no breathe/draw/auto-rotate)    |
| Contrast intent   | Pass (Aether Mist/Lagoon/ink-muted tokens)             |
| Decorative device | Interactive preview has tabs; static aria where needed |

**Gaps / follow-ups:** Run axe + VoiceOver on deployed URL; ensure ThemeToggle contrast in marketing nav; add `prefers-reduced-motion` pause for proof counters (already snaps).

---

## 4. SEO Report

| Item                 | Status                                                  |
| -------------------- | ------------------------------------------------------- |
| Unique title         | Pass — vision-led default + `%s · App` template         |
| Meta description     | Pass — self-custody / clarity positioning               |
| Open Graph / Twitter | Pass                                                    |
| `lang="en"`          | Pass                                                    |
| Indexable `/`        | Pass (`robots.index: true`)                             |
| `/dashboard` noindex | Pass (app surface)                                      |
| Canonical            | Optional — set when `NEXT_PUBLIC_APP_URL` is production |
| Structured data      | Not yet — FAQPage JSON-LD recommended next              |

---

## 5. Animation Report

| Motion             | Implementation        | Reduced motion |
| ------------------ | --------------------- | -------------- |
| Scroll reveal      | `.mh-reveal` + IO     | Instant show   |
| Hero device tilt   | CSS 3D + hover settle | Flattened      |
| Glow breathe       | `mh-breathe`          | Disabled       |
| Chart draw         | stroke-dash animation | Disabled       |
| Balance live tick  | interval jitter       | Static final   |
| Counters           | `useCountUp` ease-out | Snap to target |
| Feature icon scale | hover                 | Harmless       |
| Testimonials       | 7s auto + manual      | Auto off       |
| FAQ chevron        | rotate                | Instant        |
| Button press       | scale 0.98            | OK             |

Aligned with Phase 1 `07_Motion_System.md` (purposeful, short, spring-like easing).

---

## 6. Design Consistency Report

| Aether rule                                   | Homepage adherence                                |
| --------------------------------------------- | ------------------------------------------------- |
| Mist + Lagoon (not purple / cream-terracotta) | Yes — CSS tokens match `04_Color_System.md`       |
| Syne / Manrope / Source Serif 4 / Plex Mono   | Yes — `layout.tsx`                                |
| Brand-first hero                              | Yes — Auvora wordmark before headline             |
| No cards in hero                              | Yes — copy + device only                          |
| Cards only for interaction/grouping           | Features / why / networks use restrained surfaces |
| Quiet security copy                           | Yes — no jargon dump                              |
| Frustration framing vs competitors            | Yes                                               |
| Light-first, dark parity                      | Yes — `[data-theme=dark]` overrides               |

**Note:** In-app surfaces still use legacy teal-paper tokens until Phase 2 foundations in `@auvora/ui`. Marketing home is the first Aether-complete surface.

---

## 7. Remaining Recommendations

1. **Measure Lighthouse** on Vercel preview; tune if TBT/LCP slips.
2. **FAQPage JSON-LD** for rich results.
3. **Split MarketingHome** into lazy section chunks for faster hydration.
4. **Implement Aether tokens in `@auvora/ui`** so `/dashboard` matches marketing.
5. **Real product screenshots** later — keep CSS device until photography is brand-controlled.
6. **Nav IA Wave 2** — marketing home is done; consumer mega-menu still exists off-home.
7. **Canonical URL** once production domain is fixed in env.

---

## File index

| Path                                                  | Role                            |
| ----------------------------------------------------- | ------------------------------- |
| `apps/web/src/app/page.tsx`                           | Marketing entry                 |
| `apps/web/src/app/marketing-home.css`                 | Aether marketing styles         |
| `apps/web/src/components/marketing/MarketingHome.tsx` | Full page                       |
| `apps/web/src/components/marketing/WalletPreview.tsx` | Animated device                 |
| `apps/web/src/components/marketing/motion.tsx`        | Reveal / count / reduced motion |
| `apps/web/src/app/dashboard/page.tsx`                 | Former dashboard home           |
| `apps/web/src/components/Nav.tsx`                     | Marketing vs app chrome         |
| `apps/web/src/app/layout.tsx`                         | Fonts + SEO                     |
