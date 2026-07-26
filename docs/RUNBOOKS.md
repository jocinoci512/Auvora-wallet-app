# Runbooks

**Version:** v1.0.0-rc.1

## RB-01 — Gateway not serving /metrics/resilience

**Symptoms:** 404 on `/metrics/resilience`  
**Cause:** Long-lived process predates Phase 13 build  
**Steps:**

1. Rebuild gateway: `pnpm --filter @auvora/gateway-service build`
2. Restart gateway with loaded `.env`
3. Confirm `GET /metrics/resilience` (with `x-internal-api-key` if required)

## RB-02 — Auth ready reports database unhealthy

**Symptoms:** Login/register return 500; `GET :4001/ready` → `database: unhealthy`  
**Steps:**

1. Confirm Postgres listening on configured `DATABASE_URL` host/port
2. Start data plane: `node scripts/migrate-with-embedded-pg.mjs` or `docker compose up -d postgres`
3. Re-check auth `/ready`
4. Retry login with seed admin (`SEED_ADMIN_*`)

## RB-03 — Upstream 504 from gateway

**Symptoms:** Domain routes return 504  
**Cause:** Downstream service down or exceeding `PROXY_TIMEOUT_MS`  
**Steps:**

1. Check target service `/health`
2. Verify `*_SERVICE_URL` in gateway env
3. Inspect gateway logs for proxy errors
4. Scale/restart downstream; tune timeout only after root-cause

## RB-04 — Rate limit storms (429)

**Steps:**

1. Confirm client retries/backoff
2. Review `GATEWAY_RATE_LIMIT_MAX` / window
3. Ensure health probes remain on skip list
4. If legitimate burst, raise limit per environment values — do not disable globally

## RB-05 — Notification / queue backlog

**Steps:**

1. Check notifications service health and worker logs
2. Inspect dead-letter / max-attempt metrics
3. Verify Redis connectivity
4. Replay DLQ items only after fixing poison payloads

## RB-06 — Rollback after bad deploy

1. Helm rollback to previous revision (or redeploy prior image digests)
2. Confirm `/health` + `/ready` on gateway and auth
3. Run `pnpm perf:journeys` against staging
4. Record incident + recovery drill outcome

## RB-07 — Suspected ledger inconsistency

1. Freeze related wallets via admin suspend if needed
2. Export ledger entries for wallet IDs
3. Recompute balances from ledger; compare to balance table
4. Open incident; do not manually edit balances without dual control
