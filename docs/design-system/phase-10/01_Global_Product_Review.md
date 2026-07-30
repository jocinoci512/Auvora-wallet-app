# 01 — Global Product Review

## Verdict

Auvora’s **core wallet, admin, and design system** already read as one product family (Aether / PlatformShell). Phase 10 closes the **company surface gap**: legal drafts, trust, status chrome, help links, and offline/404 calmness. Remaining gaps are **external ecosystems** (marketing site, help CMS, email ESP, dedicated status host) that must be staffed before public GA — not invented as half-built apps inside the monorepo.

## Ecosystem map

| Surface                        | Current state                                | Company readiness                                      |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------ |
| Landing / marketing            | Repo-focused; web app entry is product       | Need branded marketing host + honest preview messaging |
| Wallet (`apps/web`)            | Production-quality UX with honesty banners   | Strong; keep simulators labeled                        |
| Admin (`apps/admin`)           | Ops wired; Support demo-labeled; SSO pending | Staging ops OK; public enterprise claim blocked        |
| Help Center                    | In-app Help + FAQ                            | Replace placeholder mailboxes; later CMS               |
| Knowledge / Learn              | `/learn` education hub                       | Keep non-advice tone                                   |
| Developer docs                 | `apps/docs` + `docs/`                        | Index updated; keep ADRs as source of truth            |
| Status                         | `/status` + API platform status              | Align with public `status.` host at GA                 |
| Support portal                 | Admin support demo; mailto placeholders      | No fake ticket success                                 |
| Email / notification templates | Infra docs; product templates incomplete     | Template kit before GA                                 |
| Error / offline / 404          | `error.tsx`, OfflineAware, `not-found`       | Calm, brand-aligned                                    |

## Unified company test

After Phase 10 wiring, a user can go **Settings → Help → Legal / Trust / Status** without leaving Aether language. Voice module + LegalShell disclaimer prevent “finished legal” theater.

## Gaps that must not be papered over

1. Counsel-published Privacy & Terms URLs
2. Production support/security inboxes
3. Live settlement rails (Phase 9 P0)
4. Marketing site that does not overclaim

## Quality gates

| Gate                  | Status                                   |
| --------------------- | ---------------------------------------- |
| Product consistency   | **Pass** within app surfaces             |
| Brand consistency     | **Pass** with voice module + legal/trust |
| Operational readiness | **Conditional** — checklist incomplete   |
| Long-term scalability | **Pass** — monorepo + packages intact    |

## Recommendation

Treat the wallet + admin + docs as the **product core**. Spin marketing/help/status as first-class company properties before GA; until then, in-app drafts labeled as drafts are the honest path.
