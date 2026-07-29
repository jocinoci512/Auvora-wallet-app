# Disaster Recovery

Last updated: **2026-07-26** (Production Deployment Readiness)

## Objectives

| Metric                 | Production target | Notes                                                      |
| ---------------------- | ----------------- | ---------------------------------------------------------- |
| RPO                    | ≤ 15 minutes      | Continuous Postgres WAL / PITR + object storage versioning |
| RTO                    | ≤ 60 minutes      | Fail over to `disaster-recovery` environment               |
| Backup retention       | 35 days (prod)    | Configurable per Terraform `postgres` module               |
| Restore validation     | Monthly           | `InfraRecoveryDrill` with verified outcome                 |
| Full DR failover drill | Quarterly         | Tabletop + technical cutover                               |

## Scope

1. **Database** — automated logical + continuous backups; PITR
2. **Object storage** — versioned buckets for reports/exports/uploads
3. **Configuration** — Helm values, Terraform state (remote backend), ExternalSecret manifests
4. **Secrets** — vault/cloud SM replicas; never only in a single region; never embedded in git
5. **Cluster state** — GitOps (Helm chart + overlays) is the recovery source of truth

## Backup strategy

### Postgres

- Enable automated backups via Terraform `modules/postgres` (`backup_retention_days`)
- Optional in-cluster CronJob: Helm `backup.cronJob.enabled=true` (logical `pg_dump`)
- Nightly job records `InfraBackupJob` rows (`componentKind=DATABASE`)
- Validate restores monthly (`InfraRecoveryDrill` status progression → `SUCCEEDED` / verified metadata)

### Redis

- AOF/RDB snapshots for cache; treat as ephemeral — warm from source systems after failover

### Object storage

- Cross-region replication on production buckets
- Lifecycle policies for cold retention

### Configuration

- Git history of `infrastructure/helm` + `infrastructure/k8s/overlays`
- Encrypted remote Terraform state (`.tfvars` gitignored)

## Restore validation procedure

1. Select a verified `InfraBackupJob` (Admin → Infrastructure → Backups).
2. Restore into an isolated namespace / scratch database (never overwrite prod first).
3. Run `prisma migrate deploy` if schema lag exists.
4. Execute smoke: `bash infrastructure/scripts/smoke-health.sh disaster-recovery` (or staging scratch).
5. Record drill via Admin → Infrastructure → Recovery (`rtoMinutes`, `rpoMinutes`, notes).
6. Fail the drill if RTO/RPO exceed targets above.

## Recovery runbooks

### 1. Database point-in-time restore

1. Freeze writes (maintenance notice via Observability).
2. Provision restore instance from backup / PITR timestamp.
3. Run `prisma migrate deploy` if schema drift.
4. Smoke: `bash infrastructure/scripts/smoke-health.sh disaster-recovery`
5. Record `InfraBackupJob` verification + `InfraRecoveryDrill` outcome in Admin → Infra → Recovery.

### 2. Regional failover (DR environment)

1. Promote `auvora-disaster-recovery` cluster (Helm `values-disaster-recovery.yaml`).
2. Ensure External Secrets remote key `auvora/disaster-recovery/app` is populated.
3. Update DNS (Terraform `dns` module / traffic manager) to DR ingress (`dr.wallet.example.com`).
4. Scale DR replicas to production sizing (`hpa` / replica overrides).
5. Validate gateway `/health`, `/ready`, Web, Admin, Swagger.
6. Communicate status via Admin maintenance notices / public `/status`.

### 3. Rollback bad release

```bash
helm rollback auvora-production --namespace auvora-production
```

Or GitHub Actions → Deploy workflow failure auto-rollback step.

Blue/green: keep traffic on prior `activeSlot` and delete the failed slot Deployment.

Canary: scale `{service}-canary` to 0 and remove canary image tag.

## Testing cadence

| Drill                     | Frequency | Owner               | Success criteria                        |
| ------------------------- | --------- | ------------------- | --------------------------------------- |
| Backup restore validation | Monthly   | Platform            | Restore completes; RPO met; smoke green |
| Full DR failover tabletop | Quarterly | Platform + Security | RTO ≤ 60m documented                    |
| Secret rotation dry-run   | Quarterly | Security            | Apps restart cleanly with rotated refs  |

Track drills as `InfraRecoveryDrill` records (Admin → Infrastructure → Recovery).

## Metrics

- Backup success rate (`InfraBackupJob` SUCCEEDED/VERIFIED)
- Mean time to restore (drill `rtoMinutes`)
- Last verified backup age
- Exposed via `GET /api/v1/admin/infrastructure/dashboard`

## Security notes

- DR credentials are environment-isolated (External Secrets remote keys)
- Zero Trust: NetworkPolicies remain enforced in DR namespace
- Container images must be the same signed digests as production
- Chart Secret creation is disabled in DR/production values
