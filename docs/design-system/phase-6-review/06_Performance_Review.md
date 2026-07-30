# 06 — Performance Review

## Observations

- PlatformShell is light; CSS shared via `core-experience.css`
- Settings search uses `useDeferredValue` (good)
- Security Center still paints demo score before `ready` completes (skeleton added alongside)
- NFT gallery keeps `nft-experience.css` (acceptable hybrid; avoid double-loading unused web3 CSS — already removed)
- Signing / Hub still load full `@auvora/ui` Alert/Button/EmptyState — bundle opportunity

## Optimizations applied

- Skeleton utility (CSS-only, no new deps)
- Tab overflow scroll avoids layout thrash from wrap reflow on small screens

## Remaining

- Route-level code splitting for Web3 browser iframe path
- Measure Lighthouse on `/settings` and `/web3` in CI
- Replace remaining heavy EmptyState imports with `cx-empty` where possible
