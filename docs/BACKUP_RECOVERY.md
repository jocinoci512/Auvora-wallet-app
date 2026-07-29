# Backup & Recovery — Infrastructure

**Task:** 036  
**Scope:** Database, object storage, configuration, disaster recovery  
**Product UI (recovery phrase settings):** [`USER_BACKUP_SETTINGS.md`](./USER_BACKUP_SETTINGS.md)  
**Related:** [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md)

---

## Objectives

| Metric           | Target (production)                    |
| ---------------- | -------------------------------------- |
| RPO (DB)         | ≤ 15 minutes (WAL / continuous backup) |
| RTO (regional)   | ≤ 1 hour to DR environment             |
| Backup retention | 30 days daily + 12 weeks weekly        |

## Database backups

### Automated (Helm)

`infrastructure/helm/auvora-wallet/templates/backup-cronjob.yaml`

- Enabled in staging/production values (`backup.cronJob.enabled: true`)
- Schedule example: `0 2 * * *` (02:00 UTC)
- Command pattern: `pg_dump | gzip`
- Optional `BACKUP_UPLOAD_URI` for object storage handoff (wire cloud CLI in operator image)

### Managed Postgres (preferred)

- Enable continuous WAL archiving / PITR
- Cross-region snapshot copy to DR
- Test restore monthly (see checklist below)

### Manual dump

```bash
pg_dump "$DATABASE_URL" --format=custom --file="auvora-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

### Restore

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" auvora-….dump
pnpm --filter @auvora/database-schema exec prisma migrate deploy
```

### Migration rollback

Prisma does not auto-down in production. Procedure:

1. Restore DB to pre-migration snapshot / PITR timestamp
2. Redeploy previous image tag
3. Document migration ID as blocked until fixed forward

## Object storage backups

| Asset                     | Strategy                                      |
| ------------------------- | --------------------------------------------- |
| User uploads / NFT caches | Versioned bucket + lifecycle                  |
| Static CDN origin         | Versioned objects; immutable release prefixes |
| Backup dumps              | Separate bucket, SSE, 30-day retention        |

Terraform interface: `infrastructure/terraform/modules/storage` (enable per env).

## Configuration backups

| Item                       | Location                                       |
| -------------------------- | ---------------------------------------------- |
| Helm values                | Git (`values-*.yaml`)                          |
| Secrets                    | Cloud secret manager (not Git)                 |
| Ingress / DNS              | IaC + registrar export                         |
| ExternalSecret remote keys | Documented inventory in `ENVIRONMENT_SETUP.md` |

Export sealed secret inventories quarterly (metadata only).

## Disaster recovery

1. Fail DNS / traffic to DR ingress (`values-disaster-recovery.yaml`)
2. Restore latest verified DB snapshot to DR Postgres
3. Helm upgrade DR with last known-good `imageTag`
4. Smoke `/health` + `/ready` + critical auth login
5. Communicate via `https://status.example.com`

Full runbooks: [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md), [`RUNBOOKS.md`](./RUNBOOKS.md).

## Recovery testing checklist

- [ ] Restore staging from yesterday’s dump; app boots
- [ ] PITR restore drill (managed DB) quarterly
- [ ] Object storage object version restore sample
- [ ] Helm rollback drill on staging
- [ ] DR environment cold-start drill (annual)
- [ ] Document time-to-recover actuals

## Indexes & integrity

- Prisma schema owns indexes/FKs; validate with `prisma migrate status`
- After restore, run application health + a sample ledger read
- Connection pooling required before load (see production `DATABASE_URL` params)
