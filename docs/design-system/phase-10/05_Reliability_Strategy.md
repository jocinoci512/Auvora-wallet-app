# 05 — Reliability Strategy

## Objectives (company)

Align with existing infra docs — do not invent parallel SLOs.

| Metric             | Target (prod docs) | Source                      |
| ------------------ | ------------------ | --------------------------- |
| RPO                | ≤ 15 minutes       | `docs/DISASTER_RECOVERY.md` |
| RTO                | ≤ 60 minutes       | same                        |
| Restore validation | Monthly            | InfraRecoveryDrill          |
| Full DR drill      | Quarterly          | Tabletop + cutover          |

## Pillars

1. **Backup** — Postgres PITR + CronJob dumps; object storage versioning (`BACKUP_RECOVERY.md`)
2. **Disaster recovery** — DR environment values; GitOps as recovery source of truth
3. **Monitoring** — OTLP / APM; alerts to on-call; status page public at GA
4. **Incident response** — Runbooks + Trust page communication principles + `/status`
5. **Redundancy** — K8s HA, managed DB/Redis, multi-AZ targets per deployment docs
6. **Deployment** — CI/CD guide; image signing; staged promote
7. **Rollback** — Helm rollback / previous image; feature flags for kill switches
8. **Business continuity** — Admin maintenance notices; user-facing status honesty

## Product ↔ ops bridge

| User sees           | Ops owns                                    |
| ------------------- | ------------------------------------------- |
| `/status`           | Platform status API + maintenance/incidents |
| `/trust`            | Comms principles during incidents           |
| Maintenance banners | Admin maintenance End/PATCH flows           |

## Gaps before public GA

- Production status host (`status.` domain)
- Backup failure + cert expiry alerts verified
- Restore drill evidence in the last 30 days
- Provider simulators false in prod

## Gate

**Reliability: Conditional** — strategy documented and partially implemented; drills and prod monitoring must be evidenced before GO.
