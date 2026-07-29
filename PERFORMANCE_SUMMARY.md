# Performance Summary

**Date:** 2026-07-27  
**Context:** Repository verification after Task 034  
**Apps measured:** `@auvora/web`, `@auvora/admin` (Next.js 15 production builds)

## Verdict

**Performance Status: PASS — no material regression**

Shared First Load JS remains on budget; experience routes stay in the ~155–178 kB First Load band.

## Web First Load (production)

| Metric                   |      Value |
| ------------------------ | ---------: |
| Shared JS (all routes)   | **103 kB** |
| Shared chunk `1015-*.js` |    46.2 kB |
| Shared framework chunk   |    54.2 kB |
| Other shared             |    2.08 kB |

### Representative routes

| Route            | Route size | First Load JS |
| ---------------- | ---------: | ------------: |
| `/`              |    6.55 kB |        178 kB |
| `/swap`          |    6.41 kB |        178 kB |
| `/web3`          |    5.97 kB |        177 kB |
| `/settings`      |    4.96 kB |        176 kB |
| `/portfolio`     |      138 B |        159 kB |
| `/design-system` |    2.51 kB |        153 kB |

## Admin First Load

| Metric                 |      Value |
| ---------------------- | ---------: |
| Shared JS (all routes) | **102 kB** |

Admin routes remain predominantly static with First Load ≈ 121–172 kB depending on SDK usage.

## Optimizations retained / verified

- `experimental.optimizePackageImports` for `@auvora/ui` / `@auvora/sdk`
- Next `images` AVIF/WebP + remotePatterns
- Font `display: 'swap'` + preload
- Route `loading.tsx` skeletons (root, settings, web3)
- `compress: true`
- Client soft-cache reduces repeat profile/portfolio refetch pressure offline

## Bundle / regression notes

- No new heavy chart libraries introduced this pass
- Nav compact mode is matchMedia-only (negligible JS)
- Transient build flake (`PageNotFoundError: /address-book`) observed once under concurrent clean/dev; clean rebuild succeeded — not a bundle defect

## Perceived performance

| Concern                | Status                           |
| ---------------------- | -------------------------------- |
| Skeleton loaders       | Present                          |
| Offline banner / toast | Present (avoids blank failures)  |
| Reduced motion         | Honored via prefs + CSS          |
| Dialog mobile sheet    | Faster thumb reach; `dvh` height |

## Recommendations (optional)

1. Prefer `next/image` on NFT media surfaces as they leave placeholders
2. Virtualize long activity lists when live volumes grow
3. Add web vitals reporting in observability when gateway smoke is available

## Related

- [`docs/PERFORMANCE_AUDIT.md`](./docs/PERFORMANCE_AUDIT.md)
- [`PRODUCT_OPTIMIZATION_REPORT.md`](./PRODUCT_OPTIMIZATION_REPORT.md)
