# Post-Launch Monitoring Plan — Closed Beta / Alpha

**Updated:** 2026-08-03  
**Scope:** Closed beta with broadcast OFF and funding LOCKED  
**Goal:** Detect trust, auth, and reliability failures early — not optimize live trading (broadcast remains off)

---

## North-star signals

| Signal                                      | Why                                 |
| ------------------------------------------- | ----------------------------------- |
| Auth success / failure / lockout rates      | Account takeovers and stuffing      |
| SMTP delivery / bounce / complaint          | Verify & reset must work            |
| Gateway 4xx/5xx and latency (p95)           | Mesh health                         |
| Mobile crash-free sessions (when SDK wired) | Stability                           |
| WC pair success vs preview fallback         | Reown readiness                     |
| Kill-switch integrity checks in CI          | Never ship broadcast ON by accident |

---

## Dashboards (minimum)

1. **Auth** — register, login, refresh, CSRF failures, lockouts, mail send errors.
2. **Gateway** — RPS, error rate, upstream timeouts per proxy target.
3. **Infra** — Postgres connections, Redis memory, pod restarts, disk.
4. **Client (later)** — crash rate, cold-start marks (`StartupTiming` JSON when diagnostics on).

Wire OTEL → existing observability service / vendor when `OTEL_ENABLED=true`.

---

## Alerts (Closed Beta severity)

| Alert                     | Condition (start points)                    | Action                                 |
| ------------------------- | ------------------------------------------- | -------------------------------------- |
| Auth 5xx                  | >1% of auth requests / 5m                   | Page on-call; check DB/Redis           |
| Mail send failures        | >3 failures / 15m                           | Check SMTP credentials / Resend status |
| Gateway upstream down     | Health fail 2 consecutive                   | Fail over / scale / rollback           |
| Unexpected broadcast flag | CI test `liveBroadcastEnabled==false` fails | **Block release**                      |
| Certificate expiry        | <21 days                                    | Renew TLS                              |
| Disk / Redis eviction     | >80%                                        | Scale / investigate                    |

Do **not** alert on “failed live tx broadcast” — preview refusal is expected.

---

## Daily Closed Beta ops (15 min)

- [ ] Review auth error + mail logs (redacted)
- [ ] Confirm no production Swagger exposure
- [ ] Skim beta feedback (`alpha@auvora.app` / in-app)
- [ ] Spot-check legal URLs still resolve
- [ ] Confirm Vercel + API health endpoints green

---

## Weekly

- [ ] Dependency advisories (esp. OTEL / Nest / Flutter)
- [ ] CORS allowlist still matches live domains
- [ ] Play Closed crash / ANR (once track live)
- [ ] Re-run kill-switch unit tests in CI
- [ ] Rotate any leaked or aged secrets if suspected

---

## Security monitoring

- Watch for spikes in register/login from single IPs (stuffing).
- Audit logs: `REGISTER`, `ACCOUNT_LOCKED`, `PASSWORD_RESET_COMPLETED`, `PASSWORD_CHANGED`.
- Never log raw JWT, SMTP password, Alchemy key, WC project secrets, or mnemonics.
- After password change / reset, confirm session revoke behavior (aligned this sprint).

---

## Incident playbooks (short)

**Suspected credential stuffing:** Lower auth rate limits; enable WAF; force lockouts; notify users if compromise confirmed.  
**SMTP outage:** Status page note; pause invites; switch SMTP provider if needed.  
**Accidental broadcast enable in a build:** Halt distribution; revoke that build; verify CI gate; force upgrade.  
**Key material concern on device:** Instruct wipe + new wallet; never ask users to paste seeds in support email.

---

## Metrics to add before GA (not required for Closed Beta)

- Real chain tip health (Alchemy) SLOs
- Live broadcast success / revert rates (only after unlock)
- Funding receive address verification audits
- Enforced CSP violation reports → enforce mode
- Distributed gateway rate-limit metrics

---

## Related

- [`docs/FINAL_PRODUCTION_READINESS_REPORT.md`](./FINAL_PRODUCTION_READINESS_REPORT.md)
- [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)
- [`docs/KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md)
