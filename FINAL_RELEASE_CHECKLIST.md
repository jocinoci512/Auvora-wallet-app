# Final Release Checklist

**Purpose:** Gate Production GA after Release Candidate.  
**RC:** **v1.0.0-rc.1** (2026-07-26) — [`docs/RELEASE_CANDIDATE_v1.0.md`](docs/RELEASE_CANDIDATE_v1.0.md)  
**Latest quality pass:** Phase 15 Enterprise Repository Audit.

**References:** [`BUILD_STATUS.md`](BUILD_STATUS.md), [`CODE_QUALITY_REPORT.md`](CODE_QUALITY_REPORT.md), [`TECHNICAL_DEBT_REPORT.md`](TECHNICAL_DEBT_REPORT.md), [`ARCHITECTURE_AUDIT.md`](ARCHITECTURE_AUDIT.md), [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md), [`PERFORMANCE_REVIEW.md`](PERFORMANCE_REVIEW.md), [`DEPENDENCY_REVIEW.md`](DEPENDENCY_REVIEW.md)

## A. Engineering confidence

- [x] Workspace lint / test (Phase 15: 29/29)  
- [x] Workspace build after Next `.next` clean (Phase 15)  
- [x] Perf harnesses present  
- [x] Architecture audit complete  
- [x] Code quality / debt / security / performance / dependency reports  
- [x] RB1 / RB3 resolved  
- [x] Root version `1.0.0-rc.1`  
- [ ] Nested package versions aligned (TD-M6)  
- [x] Major OpenAPI/SDK drift items closed  

## B. Functional readiness

- [x] Journey smoke harness  
- [x] Auth login + register + wallet list certified on RC with Postgres  
- [ ] Full domain service matrix with all processes up  
- [ ] Staging certification  

## C. Security & compliance

- [x] `pnpm audit --prod` — 0 critical  
- [x] Feasible high remediations applied  
- [x] OTEL highs accepted for RC  
- [x] Fail-closed address validation  
- [x] Resilience metrics key-protected  
- [ ] Soft-fail audit replaced with allowlist (TD-M5)  
- [ ] Pen-test / threat review before GA  

## D. Performance & resilience

- [x] Benchmarks / load / chaos / resilience sim documented  
- [ ] Staging load test  
- [ ] Resilient-proxy factory wired (TD-H1)  
- [ ] AI ANN / PGVector (TD-H3)  

## E. Operability

- [x] Helm / Terraform / Kustomize + DR / ops / runbooks  
- [x] CI deployment-artifact job (local tools may be missing)  
- [ ] Staging deploy of signed RC images  
- [ ] Backup/restore drill in target env  

## F. Accessibility & UX

- [x] A11y smoke  
- [ ] Expanded a11y before GA  
- [ ] Broader loading-state consistency (`loading.tsx`)  

## G. Documentation & contracts

- [x] RC dossier, release notes, API/security/ops guides, doc index  
- [x] Phase 15 architecture / security / performance / dependency audits  
- [ ] Codegen / contract tests in CI  

## H. Go / No-Go

| Gate | RC | GA |
|------|----|----|
| Engineering | **Go** | Re-verify clean CI + nested versions |
| Security | **Go (accepted OTEL)** | Pending pen-test + audit hard-fail |
| Ops | **Conditional** | Pending staging |
| Product | **Conditional** | Pending full matrix |

**v1.0.0-rc.1 remains the staging candidate.**  
**Production GA requires unchecked items above.**  
**Overall readiness (Phase 15):** see executive summary in chat / `CODE_QUALITY_REPORT.md`.
