# Live Validation Report — Auvora Wallet

**Task:** 038  
**Date:** 2026-07-27 (UTC validation window through 2026-07-28T00:06Z)  
**Version:** `1.0.0-rc.1`  
**Harness:** `scripts/staging-validate.mjs`, Alchemy RPC probe, chaos, journey smoke

---

## Verdict

| Domain | Status |
|--------|--------|
| Live Alchemy multi-chain RPC | **PASS** |
| Resilience / failure simulation | **PASS** |
| Gateway chaos / degraded ready | **PASS** |
| Product UI surface journeys | **PASS** (14 checks; 9 soft-skipped for offline mesh) |
| Full authenticated mutation UAT (create/send/swap…) | **PARTIAL** — soft-skipped without Postgres/auth/wallet mesh |
| Managed K8s staging cutover | **NOT ATTESTED** this run (config ready; soak pending ops) |

---

## Blockchain (Alchemy live)

`scripts/verify-alchemy-rpc.mjs` — all five configured networks returned **200**:

| Chain | Result | Notes |
|-------|--------|-------|
| Ethereum | OK | `eth_blockNumber` |
| BNB Smart Chain | OK | Shared EVM Alchemy path |
| Solana | OK | Health / slot path |
| Tron | OK | Block height path |
| Bitcoin | OK | Tip / health path |

Additional coverage:

| Check | Evidence | Status |
|-------|----------|--------|
| Wallet generation | Wallet engine integration + UI `/wallets/create` surface 200 | Contract OK; live create soft-skipped without auth DB |
| Balance retrieval | Alchemy provider integration + live RPC | Provider path OK |
| Transaction history | Provider transfer/history paths in unit/integration | OK in tests |
| Network health | Live RPC probe + gateway health | OK |
| RPC failover | Integration: registry prefers Alchemy; retry on transient | OK |
| Graceful errors | Unauthorized not retried; chaos invalid path handled | OK |

Gated live Jest suite `alchemy.providers.integration.spec.ts` “probes health for every configured Alchemy chain” remains **skipped** in CI (mocked path ran 10/10).

---

## Production services

| Integration | Validation | Status |
|-------------|------------|--------|
| Alchemy | Live RPC probe | **PASS** |
| Email provider | Staging SMTP templated; no live send attested | **CONFIG READY** |
| Authentication | Login/register soft-skipped (auth upstream / DB) | **PARTIAL** |
| Object storage | Bucket/region in staging values | **CONFIG READY** |
| Logging | Gateway/ Nest logging; OTEL endpoint templated | **PARTIAL** (collector not required locally) |
| Monitoring | `/metrics/resilience`, `/status` surfaces, chaos metrics check | **PASS** (local gateway) |

---

## User acceptance (journey smoke)

`node scripts/perf/journey-smoke.mjs` → **passed 14 / failed 0 / skipped 9**

| Journey / surface | Result |
|-------------------|--------|
| Platform health | PASS |
| Ready surfaces deps | PASS (documents degraded deps) |
| Swagger | PASS |
| Auth login / registration | SKIPPED (upstream/DB) |
| Wallet list/create contract | SKIPPED |
| Blockchain / payments / compliance / notifications / AI / analytics contracts | SKIPPED |
| Observability status | PASS |
| Product experience surfaces | PASS — `/portfolio`, `/swap`, `/bridge`, `/staking`, `/nfts`, `/web3`, `/settings`, `/security`, `/notifications`, `/activity`, etc. **200** |

UI preview servers must be running (`.\scripts\start-previews.ps1`). Stale `.next` can yield transient 500/404 — `-Clean` recovers.

---

## Failure testing

| Scenario | Method | Result |
|----------|--------|--------|
| RPC unavailable / retry | Alchemy integration + resilience-sim | PASS |
| API invalid path | chaos `invalid_upstream_path_handled` | PASS |
| Database reconnect | Not live (Postgres down locally) | Simulated via degraded `/ready` 503 |
| Redis reconnect | Not live locally | Config + degraded readiness |
| WebSocket disconnect | Not exercised live | Documented for cluster soak |
| Network latency / timeouts | resilience-sim timeout + circuit + bulkhead + fallback | PASS |
| Auth down → ready | chaos allows **503** as degraded response | PASS |

---

## Engineering gates (Task 038)

| Gate | Exit |
|------|------|
| `pnpm install` | 0 |
| `pnpm lint` | 0 |
| `pnpm test` | 0 (35 turbo tasks) |
| `pnpm build` | 0 (29 turbo tasks) |
| Integration specs (blockchain + bridge/connections/market-data/nft/staking/swap/wallet) | 0 |
| Nest `test:e2e` (13 services) | 0 |
| `staging-validate.mjs` | 0 — recommendation `staging_validation_green_continue_soak` |

---

## Outstanding for full live UAT

1. Bring up Postgres + Redis + auth/wallet/blockchain mesh (or deploy Helm staging).  
2. Seed admin credentials; re-run journey smoke without soft-skips.  
3. Execute funded/testnet mutation paths (send/swap/bridge/stake) under staging keys.  
4. Attest SMTP, object storage upload, and OTEL export on the cluster.

---

## Related

- [`STAGING_DEPLOYMENT.md`](./STAGING_DEPLOYMENT.md)  
- [`OPERATIONAL_READINESS.md`](./OPERATIONAL_READINESS.md)  
- [`KNOWN_PRODUCTION_LIMITATIONS.md`](./KNOWN_PRODUCTION_LIMITATIONS.md)  
