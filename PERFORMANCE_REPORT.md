# Performance Report — Pre-Deployment Audit

**Date:** 2026-07-27

---

## Summary

| Signal | Result |
|--------|--------|
| Web First Load JS (shared) | ~103 kB |
| Admin / Docs shared | ~102 kB |
| Production build | PASS (~3m) |
| Resilience simulation | Available via `pnpm perf:resilience` |
| Load / chaos harnesses | Present under `scripts/perf/` |

**Performance status: PASS for RC budgets** (no regressions found in this audit build)

---

## Observations

- Next apps use `optimizePackageImports` for `@auvora/ui` / `@auvora/sdk`  
- App Router static generation for most marketing/product surfaces  
- Gateway proxy timeout / rate limits configured via env  
- Domain workers are env-gated (avoid idle CPU when disabled)  

## Safe optimizations already in tree

- Production `.next` wipe before Docker/Next prod builds  
- Preview auto-clean of stale prod artifacts  
- Turbo remote-cache-ready task graph  

## Not changed in this audit

No aggressive bundle rewrites or caching redesign (would risk behavior change). Prior load/chaos docs remain authoritative for soak numbers (`docs/LOAD_TEST_RESULTS.md`).

## Residual performance risks

| Risk | Mitigation |
|------|------------|
| Cold `next dev` compile latency | Expected; use production build for deploy |
| Multi-replica rate-limit skew | Redis plan before HA GA |
| Live chain RPC latency | Alchemy timeouts + retry/circuit metrics |
