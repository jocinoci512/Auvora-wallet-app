# ADR 0003: Provider-Agnostic Compliance Adapters

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** Identity, sanctions, PEP, fraud, and travel-rule vendors vary by market; the platform must not hard-code a single vendor.

## Decision

Define domain **provider ports** (KYC, document OCR, sanctions, PEP, adverse media, risk scoring, fraud, travel rule, watchlist) and bind Nest DI to:

1. **Simulator adapters** when `COMPLIANCE_SIMULATOR_ENABLED=true` (non-production only)
2. **Unavailable / fail-closed adapters** when simulators are disabled (explicit errors / deny semantics at the application layer)

Local risk scoring may still run without an external vendor so internal policy evaluation remains usable offline.

## Consequences

**Positive**

- Vendor swaps without rewriting application services
- Safe default for production (simulators blocked)

**Negative**

- Real vendor SDKs still need concrete adapters before go-live with regulated traffic
- Simulator behavior must not leak into production configs

## Alternatives considered

- **Single hard-coded vendor SDK** — Faster MVP, high switching cost and vendor lock-in.
- **Always-on simulators** — Unacceptable for production integrity.
