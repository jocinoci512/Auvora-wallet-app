# Public Launch Checklist — Auvora Wallet

**Task:** 036  
**Goal:** Gate public production launch  
**Current track:** RC1 → staging GO · production GA requires this checklist

---

## Infrastructure

- [ ] Production Kubernetes cluster + namespaces
- [ ] Managed PostgreSQL (pooling, PITR)
- [ ] Managed Redis
- [ ] Object storage bucket + CDN origin
- [ ] Ingress / load balancer with multi-host TLS
- [ ] DNS for all public hosts (see [`DOMAIN_CONFIGURATION.md`](./DOMAIN_CONFIGURATION.md))
- [ ] External Secrets / secret store wired
- [ ] Backup CronJob enabled + upload target verified
- [ ] DR environment values validated

## Security

- [ ] All production secrets rotated from templates
- [ ] `COOKIE_SECURE=true`, `COOKIE_DOMAIN=.example.com`
- [ ] CORS allow-list exact-match production hosts
- [ ] HSTS at ingress
- [ ] CSP Report-Only reviewed; enforce plan scheduled
- [ ] Rate limits tuned; Redis multi-node RL plan if HA
- [ ] `INTERNAL_API_KEY` required
- [ ] Provider simulators **false**
- [ ] Dependency audit accepted or remediated
- [ ] Pen-test / security review sign-off

## Performance

- [ ] Gateway load soak on staging
- [ ] Web First Load budgets within RC1 baselines
- [ ] HPA limits validated under synthetic load
- [ ] DB connection pool headroom confirmed

## Monitoring

- [ ] OTLP exporter to production APM
- [ ] Alerts routed to on-call
- [ ] Status page reachable at `https://status.example.com`
- [ ] Backup failure alert
- [ ] Certificate expiry alert

## Testing

- [ ] `pnpm lint` / `test` / `build` green on release tag
- [ ] Integration suites green
- [ ] E2E suites green
- [ ] Staging journey smoke (auth + wallet live)
- [ ] Rollback drill on staging

## Backups & recovery

- [ ] Successful restore drill within last 30 days
- [ ] RPO/RTO documented and accepted
- [ ] Config backup inventory current

## Compliance & legal

- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Support contact published
- [ ] Regional compliance requirements reviewed

## Documentation

- [ ] [`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md)
- [ ] [`DOMAIN_CONFIGURATION.md`](./DOMAIN_CONFIGURATION.md)
- [ ] [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md)
- [ ] [`CI_CD_GUIDE.md`](./CI_CD_GUIDE.md)
- [ ] [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)
- [ ] [`MONITORING_GUIDE.md`](./MONITORING_GUIDE.md)
- [ ] [`APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md)
- [ ] Runbooks updated

## Go / No-Go

| Decision             | Criteria                                                                        |
| -------------------- | ------------------------------------------------------------------------------- |
| **GO public launch** | All critical boxes above checked; staging soak ≥ agreed window; on-call staffed |
| **NO-GO**            | Open critical security, backup, or mesh failures                                |

### Production URLs (launch)

- https://example.com
- https://app.example.com
- https://api.example.com
- https://admin.example.com
- https://docs.example.com
- https://status.example.com
