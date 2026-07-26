# ADR 0002: Compliance as Policy Enforcement Engine

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** Wallet and payment flows need KYC/AML/risk gates without coupling domain logic into those services or regenerating the monorepo.

## Decision

Introduce `@auvora/compliance-service` as the system of record for compliance state and policy evaluation.

- Public user/admin APIs are exposed via the gateway under `/api/v1/compliance` and `/api/v1/admin/compliance`.
- Sibling services integrate through **internal HTTP** endpoints (`/api/v1/internal/compliance/*`) authenticated with `x-internal-api-key`.
- The gateway continues to **deny** public access to `/api/v1/internal/**`.

## Consequences

**Positive**

- Clear bounded context; payments/wallet remain free of KYC schema ownership
- Replaceable vendor adapters behind ports
- Opt-in payments hook preserves Phase 5 behavior when `COMPLIANCE_SERVICE_URL` is unset

**Negative**

- Cross-service latency and availability coupling for fraud checks when enabled
- Eventual consistency between payment intent and compliance alerts/cases

## Alternatives considered

- **Embed compliance in payments** — Faster short-term, breaks ownership and blocks multi-channel policy reuse.
- **Shared Nest library imported in-process** — Violates deployable service boundaries and complicates independent scaling.
