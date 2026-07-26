# Final Release Checklist

**Purpose:** Gate Production GA after Release Candidate.  
**RC:** **v1.0.0-rc.1** (2026-07-26) — [`docs/RELEASE_CANDIDATE_v1.0.md`](docs/RELEASE_CANDIDATE_v1.0.md)  
**Latest quality pass:** Code quality audit refresh (contract alignment + unused dep cleanup).

**References:** [`BUILD_STATUS.md`](BUILD_STATUS.md), [`CODE_QUALITY_REPORT.md`](CODE_QUALITY_REPORT.md), [`TECHNICAL_DEBT_REPORT.md`](TECHNICAL_DEBT_REPORT.md), [`docs/SECURITY_GUIDE.md`](docs/SECURITY_GUIDE.md), [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md)

## A. Engineering confidence

- [x] Workspace lint / test / build (last RC + refresh — reconfirm after this audit)  
- [x] Perf harnesses present  
- [x] Architecture boundaries clean  
- [x] Code quality audits completed (initial + post-RC refresh)  
- [x] RB1 / RB3 resolved  
- [x] Root version `1.0.0-rc.1`  
- [ ] Nested package versions aligned (TD-M6)  
- [x] Major OpenAPI/SDK drift items closed (AI knowledge, analytics, custody)  

## B. Functional readiness

- [x] Journey smoke harness  
- [x] Auth login + register + wallet list certified on RC with Postgres  
- [ ] Full domain service matrix (blockchain, payments, compliance, custody, notifications, AI, analytics) with all processes up  
- [ ] Staging certification  

## C. Security & compliance

- [x] `pnpm audit --prod` — 0 critical  
- [x] Feasible high remediations applied  
- [x] OTEL highs accepted for RC  
- [x] Fail-closed address validation  
- [x] Resilience metrics key-protected  
- [ ] Pen-test / threat review before GA  

## D. Performance & resilience

- [x] Benchmarks / load / chaos / resilience sim documented  
- [ ] Staging load test  
- [ ] Resilient-proxy factory wired (TD-H1)  

## E. Operability

- [x] Helm / Terraform / Kustomize + DR / ops / runbooks  
- [ ] Staging deploy of signed RC images  
- [ ] Backup/restore drill in target env  

## F. Accessibility & UX

- [x] A11y smoke  
- [ ] Expanded a11y before GA  
- [ ] Broader loading-state consistency  

## G. Documentation & contracts

- [x] RC dossier, release notes, API/security/ops guides, doc index  
- [x] OpenAPI/SDK AI + analytics + custody alignment (audit refresh)  
- [ ] Codegen / contract tests in CI  

## H. Go / No-Go

| Gate | RC | GA |
|------|----|----|
| Engineering | **Go** | Re-verify after audit refresh CI |
| Security | **Go (accepted OTEL)** | Pending pen-test |
| Ops | **Conditional** | Pending staging |
| Product | **Conditional** | Pending full matrix |

**v1.0.0-rc.1 remains the staging candidate.**  
**Production GA requires unchecked items above.**
