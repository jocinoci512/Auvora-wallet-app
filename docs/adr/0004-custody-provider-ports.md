# ADR 0004: Multi-Model Custody via Provider Ports

- **Status:** Accepted
- **Date:** 2026-07-25
- **Context:** Auvora must support self-custody through HSM/MPC institutional models without rewriting wallet or blockchain business logic.

## Decision

Introduce `@auvora/custody-service` as the system of record for cryptographic key lifecycle and transaction signing.

- Domain port `CustodyProviderPort` with strategies for SELF, HOSTED, SHARED, INSTITUTIONAL, MPC, and HSM.
- Application services orchestrate keys, signing requests, approvals, recovery, and policy evaluation.
- Sensitive material is encrypted (`CUSTODY_FIELD_ENCRYPTION_KEY`) and never exposed on public/admin APIs.
- Downstream services (e.g. blockchain) integrate optionally via internal HTTP + `x-internal-api-key`.

## Consequences

**Positive**

- Provider swaps without changing signing/approval workflows
- Clear security boundary for key material
- Fail-closed unavailable adapters when simulators are disabled

**Negative**

- Additional network hop for signing when custody is enabled
- Real HSM/MPC adapters still required before regulated production use

## Alternatives considered

- **Embed keys in wallet service** — Couples ledger domain to cryptography and weakens custody isolation.
- **Hard-code a single MPC vendor** — Faster MVP, high lock-in cost.
