# 03 — Architecture Review

## What holds

- Gateway-routed microservices (auth, observability, infrastructure, analytics, …)
- Permission-gated admin controllers
- SDK as the single client contract for admin apps
- Public status page fed by maintenance notices (real path)

## What was incomplete (fixed where critical)

| Gap                                               | Resolution                        |
| ------------------------------------------------- | --------------------------------- |
| SDK missing alert/incident mutations              | Added acknowledge/resolve         |
| Maintenance no deactivate                         | Service `setActive` + PATCH route |
| Admin UI not consuming dashboard incident payload | Overview strip                    |

## Architectural decisions (justified)

1. **Confirm dialogs over full modal system** — fastest safe guardrail without new design language.
2. **Search-on-apply filters** — protects gateway during incident typing; explicit Search matches ops mental model.
3. **Demo support isolated in `support-demo.ts`** — swappable when ticket domain ships.
4. **No parallel admin design system** — Mist/Lagoon token overrides only.

## Scalability note

Architecture can scale if queues, DB, and CDN strategies from Phase 8 docs are followed. Admin console is not the bottleneck for user traffic; false-confidence UI was the ops bottleneck.
