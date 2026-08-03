# Known Limitations — Auvora Wallet

**Updated:** 2026-08-03 (Final Production Stabilization Sprint)  
**Channel:** Version 1.0 Alpha / Closed Beta  
**Broadcast:** OFF · **Funding:** LOCKED · **NFT:** ABSENT

---

## Product / funds safety

| Limitation                                        | Impact                                          | Mitigation                                                     |
| ------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Live transaction broadcast disabled               | Send / swap / bridge / WC send do not hit chain | `liveBroadcastEnabled=false`; WC + TransactionEngine gates     |
| Funding receive locked                            | No QR / copy / share of funding addresses       | `allowFundingAddresses=false` + redaction                      |
| Portfolio balances / history are preview adapters | Totals look like money but are simulated        | Banners + action labels “(preview)” / “(locked)”; tester brief |
| AVAX listed as ETH-contract preview               | Not Avalanche C-Chain support                   | Treat as demo placeholder until Avalanche ships                |
| NFT product absent                                | No collectibles UX                              | Feature catalog ABSENT; `/nfts` redirect; gateway 410          |

---

## Auth / security

| Limitation                                     | Impact                                | Mitigation                                          |
| ---------------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| Access JWT in JS storage (`sessionStorage`)    | XSS can steal access token            | Short TTL; refresh httpOnly; migrate httpOnly later |
| MFA flag not enforced at login                 | “MFA enabled” is not a challenge flow | Do not claim MFA-ready                              |
| Login still differentiates some account states | Status probing residual               | Lockout + IP rate limit; harden further before GA   |
| Gateway rate limit in-memory                   | Uneven across replicas                | Single replica or Redis limiter for HA              |
| CSP Report-Only                                | Weaker XSS defense-in-depth           | Observe then enforce                                |
| Pen-test not completed                         | Unknown residual vulns                | Required before public GA                           |

---

## Domains / deployment

| Limitation                                                      | Impact                                      | Mitigation                                              |
| --------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Dual domain strings (`wallet.auvora.app` vs `auvorawallet.com`) | Legal links / Play / emails may disagree    | Canonicalize to one public domain before Closed Testing |
| DNS/TLS cutover must be attested on real hosts                  | Domains may not resolve or mismatch ingress | Follow deployment checklist                             |
| Terraform largely stubs                                         | Cloud provisioning manual                   | Managed Postgres/Redis + Helm                           |
| Crash / analytics SDKs unwired                                  | No remote crash pipeline yet                | Honest Privacy copy; wire before scale                  |

---

## Mobile / platform

| Limitation                          | Impact                                 | Mitigation                       |
| ----------------------------------- | -------------------------------------- | -------------------------------- |
| Upload keystore may be missing      | Play rejects debug-signed AAB          | Add `android/key.properties`     |
| iOS IPA not built on Windows        | No TestFlight from this host           | Archive on macOS                 |
| Biometric + auto-lock interaction   | Possible lock mid-auth on pause        | **DEVICE VERIFICATION REQUIRED** |
| Reown physical pairing              | Relay/dashboard not proven here        | **DEVICE VERIFICATION REQUIRED** |
| HD receive addresses                | Funding locked until off-device verify | **DEVICE VERIFICATION REQUIRED** |
| Store marketing graphics incomplete | Listing polish blocked                 | `docs/store-assets/alpha-1.0/`   |

---

## Web companion

| Limitation                         | Impact                           | Mitigation             |
| ---------------------------------- | -------------------------------- | ---------------------- |
| DEMO / COMING_SOON heavy surfaces  | Not a full live trading terminal | Feature catalog badges |
| dApp browser is iframe HTTPS shell | Not a full browser engine        | Document limits        |
| Advanced settings placeholders     | No production RPC mutation       | Local-only toasts      |

---

## Explicit non-goals (this channel)

- Unrestricted public marketing launch without checklist
- Enabling live broadcast or funding without audited adapters + sign-off
- App Store / Play **production** listing claiming live funds
- Guaranteeing multi-region active-active without DR evidence

---

## Related

- [`docs/FINAL_PRODUCTION_READINESS_REPORT.md`](./FINAL_PRODUCTION_READINESS_REPORT.md)
- Root [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md) (historical Alpha register — prefer this file for current)
