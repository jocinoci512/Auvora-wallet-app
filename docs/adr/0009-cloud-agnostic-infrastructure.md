# ADR 0009: Cloud-Agnostic Production Infrastructure

## Status

Accepted — 2026-07-26

## Context

Phases 1–11 delivered application platforms. Production requires multi-environment deployment, GitOps, HA, and DR without locking the organization to a single cloud.

## Decision

1. **Infrastructure as Code under `infrastructure/`** — Terraform modules (interfaces), Helm umbrella chart, Kustomize overlays.
2. **Seven isolated environments:** local, development, qa, testing, staging, production, disaster-recovery.
3. **Cloud-agnostic modules** — networking, k8s, postgres, redis, storage, secrets, iam, dns, loadbalancer, monitoring; providers plugged via `enabled` flags.
4. **Container standard** — multi-stage Dockerfiles, non-root, startup/liveness/readiness probes; Nest + Next images parameterized by `SERVICE`/`APP`.
5. **Secrets via External Secrets + `@auvora/secrets`** — chart Secret only for local; no hardcoded production secrets in git.
6. **Deployment strategies** — Helm `global.deploymentStrategy`: rolling, blue-green (slot/activeSlot), canary (stable + canary Deployments).
7. **Ops data plane** — deployment/backup/recovery/feature-flag records in Postgres; Admin infrastructure portal.
8. **CI/CD** — quality, security scan, image build/sign/scan, infra validate, pre-deploy artifact validation, manual deploy with rollback.
9. **DR objectives** — RPO ≤ 15 minutes, RTO ≤ 60 minutes with documented restore validation.

## Consequences

- Same Helm chart deploys to any conformant Kubernetes cluster.
- Terraform modules start disabled; enabling requires choosing a cloud provider implementation.
- DR is an active environment + runbooks, not a single-region hope.
- Production releases are blocked unless lint/test/build and Helm/Terraform artifact validation succeed.
