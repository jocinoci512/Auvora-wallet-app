# Known Production Limitations — Staging Validation

**Task:** 038  
**Date:** 2026-07-27  
**Version:** `1.0.0-rc.1`  
**Supplements:** [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md) (Task 037)

These are **production/staging operational limitations**, not new feature gaps. Do not treat soft-skipped journeys as full business E2E.

---

## Staging / infrastructure

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Full Helm staging cutover not attested in Task 038 host run | DNS/TLS/mesh not proven live | Operators complete deploy per [`STAGING_DEPLOYMENT.md`](./STAGING_DEPLOYMENT.md) |
| Local Postgres/Redis often down during eng validation | Gateway `/ready` = 503; auth/wallet mutations soft-skip | Start managed data plane before soak sign-off |
| Helm chart does not embed Postgres/Redis (`enabled: false`) | Requires external managed services | Provision RDS/Memorystore (or equiv.) + secrets |
| Terraform modules largely stubs | Cloud provisioning still manual | Use managed services + Helm |
| Backup upload needs object-storage credentials | Cron may dump without remote retention | Set upload URI + keys; verify CronJob logs |
| In-cluster smoke treats `/ready` 200-only | Fails during intentional degrade | Run smoke only when data plane healthy; chaos allows 503 |

---

## Blockchain / providers

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Live funded send/swap/bridge/stake not exercised here | No financial path attestation | Staging soak with test keys / controlled amounts |
| Alchemy live Jest health probe gated/skipped in CI | CI uses mocks | Keep `verify-alchemy-rpc.mjs` in staging gates |
| Domain simulators still default-on for swap/nft/staking/bridge/connections when keys absent | Non-chain domains may not hit live vendors | Flip simulators off when provider keys exist |

---

## Security / platform (carried forward)

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| CSP Report-Only (not enforced) | Weaker XSS defense-in-depth | Observe → enforce at edge before GA |
| JWT often in `localStorage` | XSS token theft risk | Prefer short-lived tokens; httpOnly plan |
| Gateway rate limit in-memory | Uneven across replicas | Single-replica staging OK; Redis HA before multi-replica GA |
| Pen-test not completed | Unknown residual vulns | Required before public GA |
| OTEL dependency advisories | Supply-chain residual | Upgrade soak accepted for RC |

---

## Product / UX (carried forward)

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Portfolio / some settings use preview/sample rows | Must not treat as live balances/sessions | Keep preview banners; wire live APIs for GA |
| Auth UX access-token oriented | No polished login/register for public | Closed beta ops provide tokens |
| dApp browser iframe HTTPS shell | Not a full browser engine | Document capability limits |
| nft/staking/connections/bridge lack dedicated Nest e2e packages | Narrower automated HTTP coverage | Unit + integration + journey surfaces |

---

## Testing methodology

| Limitation | Impact |
|------------|--------|
| Journey smoke soft-skips unreachable domain APIs | Surface 200 ≠ authenticated mutation success |
| Web/admin Jest often `passWithNoTests` | Fewer UI unit tests |
| WebSocket disconnect / DB reconnect not fully chaos-automated | Rely on K8s soak + ops drills |

---

## Production recommendation (Task 038)

| Audience | Recommendation |
|----------|----------------|
| Staging soak / closed beta | **CONTINUE** — config + live Alchemy + engineering gates green; complete mesh + DB soak |
| Unrestricted public GA | **HOLD** — public launch checklist, pen-test, CSP enforce, live mutation UAT, Redis HA rate limit |

---

## Related

- [`LIVE_VALIDATION_REPORT.md`](./LIVE_VALIDATION_REPORT.md)  
- [`OPERATIONAL_READINESS.md`](./OPERATIONAL_READINESS.md)  
- [`PRODUCTION_SIGNOFF.md`](./PRODUCTION_SIGNOFF.md)  
- [`docs/PUBLIC_LAUNCH_CHECKLIST.md`](./docs/PUBLIC_LAUNCH_CHECKLIST.md)  
