# Release Notes — Auvora Wallet v1.0.0-rc.1

**Release date:** 2026-07-26  
**Codename:** Final Production Readiness / Release Candidate

## Highlights

- First **Release Candidate** for the enterprise Auvora Wallet platform
- Phases 1–13 delivered: auth, wallets, blockchain, payments, compliance, custody, notifications, AI, analytics, observability, cloud-agnostic infrastructure, performance/resilience
- Enterprise Readiness Verification and code-quality audit completed
- RC hardening: fail-closed local address format validation; protected resilience metrics

## What's included

- Modular NestJS services behind API gateway
- Web (`:3000`) and Admin (`:3001`) portals
- OpenAPI at `/api/docs`
- Helm / Terraform / Kustomize multi-environment packaging
- Perf harnesses: load, chaos, a11y smoke, journeys, resilience simulation

## Security notes for operators

- Set `INTERNAL_API_KEY` in all non-local environments; scrape `/metrics/resilience` with `x-internal-api-key`
- Keep External Secrets / vault wiring enabled outside local
- Review accepted OpenTelemetry highs before GA

## Known limitations (RC)

- Full authenticated E2E of every domain journey requires Postgres + all domain services running
- AI vector search still uses bounded in-process scan (PGVector planned)
- Gateway resilient-proxy circuit metrics populate when proxies migrate to shared factory
- Frontend JWT-in-localStorage is a demo/admin pattern — harden for GA if required

## Upgrade / install

See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) and [`FINAL_RELEASE_CHECKLIST.md`](../FINAL_RELEASE_CHECKLIST.md).

## Verification URLs (local)

| Surface | URL                            |
| ------- | ------------------------------ |
| Web     | http://localhost:3000          |
| Admin   | http://localhost:3001          |
| API     | http://localhost:4000          |
| Swagger | http://localhost:4000/api/docs |
| Health  | http://localhost:4000/health   |
