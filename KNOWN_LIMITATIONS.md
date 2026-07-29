# Known Limitations — Auvora Wallet

**Task:** 037  
**Date:** 2026-07-27  
**Audience:** Operators, beta users, executive stakeholders

---

## Product / UX

| Limitation                                                  | Impact                                       | Mitigation                                               |
| ----------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Portfolio holdings use illustrative sample data             | Users must not treat totals as live balances | Preview banner on Portfolio; use Market / API for quotes |
| Settings Security Center / devices / dApps use preview rows | Not authoritative session inventory          | Label as preview; use live admin/API when available      |
| Web auth UX is access-token oriented                        | No polished login/register pages             | Closed beta ops provide tokens; full auth UX backlog     |
| Advanced settings / account deletion placeholders           | Destructive flows incomplete                 | Do not enable for GA without implementation              |
| Admin loading/error shells thinner than web                 | Less polished admin edge cases               | Acceptable for beta; TD-H5                               |
| dApp browser is iframe HTTPS shell                          | Not a full browser engine                    | Document capability limits to users                      |

---

## Security / platform

| Limitation                     | Impact                      | Mitigation                                     |
| ------------------------------ | --------------------------- | ---------------------------------------------- |
| CSP Report-Only (not enforced) | Weaker XSS defense-in-depth | Observe then enforce at edge                   |
| JWT often in `localStorage`    | XSS token theft risk        | Prefer short-lived tokens; migrate to httpOnly |
| Gateway rate limit in-memory   | Uneven across replicas      | Single-replica or Redis plan for HA            |
| OTEL dependency advisories     | Supply-chain residual       | Accepted for RC; upgrade soak                  |
| Pen-test not completed         | Unknown residual vulns      | Required before public GA                      |

---

## Operations / deployment

| Limitation                                                 | Impact                              | Mitigation                             |
| ---------------------------------------------------------- | ----------------------------------- | -------------------------------------- |
| Live DNS/TLS cutover not attested here                     | Domains may not resolve yet         | Follow PUBLIC_LAUNCH_CHECKLIST         |
| Terraform modules largely stubs                            | Cloud provisioning manual           | Use managed services + Helm            |
| Backup upload to object storage operator-wired             | Dumps may stay local without config | Set `BACKUP_UPLOAD_URI` / managed PITR |
| Full mesh mutation E2E soft-skips when upstreams down      | False confidence without Postgres   | Staging soak required                  |
| nft/staking/connections/bridge lack dedicated e2e packages | Narrower automated coverage         | Covered by unit/integration            |

---

## Testing

| Limitation                                       | Impact                             |
| ------------------------------------------------ | ---------------------------------- |
| Web/admin Jest mostly `passWithNoTests`          | Fewer UI unit tests                |
| Journey smoke soft-skips unreachable domain APIs | Surface checks ≠ full business E2E |

---

## Explicit non-goals of RC1 / closed beta

- Unrestricted public marketing launch without checklist
- App Store / Play production listing without legal pages
- Guaranteed multi-region active-active without DR drill evidence

---

## Related

- [`PRODUCTION_SIGNOFF.md`](./PRODUCTION_SIGNOFF.md)
- [`docs/PUBLIC_LAUNCH_CHECKLIST.md`](./docs/PUBLIC_LAUNCH_CHECKLIST.md)
- [`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md)
