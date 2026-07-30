# 11 — Production Operations

## Operate-from-admin map

| Job                         | Where                                           |
| --------------------------- | ----------------------------------------------- |
| Triage incidents            | `/observability`, `/observability/incidents`    |
| Publish maintenance         | `/observability/maintenance` → public `/status` |
| Toggle rollouts             | `/infrastructure/config`                        |
| Deploy / backup / DR drills | `/infrastructure/*`                             |
| User abuse / access         | `/users/[id]`                                   |
| Prove who changed what      | `/security/audit`                               |
| Customer cases (preview)    | `/support`                                      |

## Linkage to existing runbooks

| Guide       | Path                                                   |
| ----------- | ------------------------------------------------------ |
| Operations  | `docs/OPERATIONS_GUIDE.md`                             |
| Runbooks    | `docs/RUNBOOKS.md`                                     |
| Monitoring  | `docs/MONITORING_GUIDE.md`                             |
| Deployment  | `docs/DEPLOYMENT_GUIDE.md`, `PRODUCTION_DEPLOYMENT.md` |
| DR / backup | `docs/DISASTER_RECOVERY.md`, `BACKUP_RECOVERY.md`      |

## Production readiness checklist (Phase 8)

- [x] Ops overview with live unhealthy/incident counts (when APIs up)
- [x] Logs route exists
- [x] Maintenance publish path
- [x] Feature flag toggles
- [x] Audit log UI
- [x] Users/RBAC UI
- [ ] Admin SSO / break-glass procedure documented per environment
- [ ] Support ticket domain
- [ ] Alertmanager routing verified in staging
- [ ] Load test of gateway with admin concurrent reads

## Incident banner

Active maintenance notices appear on admin overview when returned by the ops dashboard or maintenance API.
