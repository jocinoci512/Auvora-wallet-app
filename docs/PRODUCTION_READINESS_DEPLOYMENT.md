# Production Deployment Readiness

Last verified: **2026-07-26**

## Checklist

| Requirement                                    | Status   | Evidence                                                                                                            |
| ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Every service deployable via Helm + IaC        | **PASS** | Umbrella chart covers 11 Nest services + web/admin + optional postgres/redis; Terraform modules for cloud resources |
| Rolling / blue-green / canary                  | **PASS** | `global.deploymentStrategy`; Deploy workflow inputs; Helm tests                                                     |
| Backups / restores / DR with RPO/RTO           | **PASS** | RPO ≤15m, RTO ≤60m; CronJob template; `DISASTER_RECOVERY.md`                                                        |
| Secrets externally managed                     | **PASS** | `secrets.create=false` + ExternalSecret in non-local envs; local-only chart Secret                                  |
| Non-root + startup/liveness/readiness          | **PASS** | Global securityContext; probes on services/apps; postgres/redis probes                                              |
| CI lint/test/security/image/infra/deploy gates | **PASS** | `ci.yml` quality + deployment-artifacts + security-gates; image/sign/scan/deploy workflows                          |
| Architecture diagrams                          | **PASS** | environments / networking / service topology                                                                        |
| Workspace build + artifact validation          | **PASS** | See `BUILD_STATUS.md`                                                                                               |

## Diagrams

- [`docs/diagrams/deployment-environments.md`](./diagrams/deployment-environments.md)
- [`docs/diagrams/networking-topology.md`](./diagrams/networking-topology.md)
- [`docs/diagrams/service-topology.md`](./diagrams/service-topology.md)

## Validation command

```bash
bash infrastructure/scripts/validate-deployment-artifacts.sh
```
