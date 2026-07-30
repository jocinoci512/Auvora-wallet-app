# 07 — Operational Improvements

Implemented in this follow-up (operational excellence focus):

1. Incident Center triage (acknowledge / resolve)
2. Alert Center triage (acknowledge / resolve)
3. Maintenance notice end (PATCH `isActive: false`)
4. Confirmations on destructive identity and flag actions
5. Ops chrome pass: incidents, SLOs, capacity, dependencies, traces
6. Search-on-apply for logs / users / audit
7. Overview open-incident strip + triage CTA
8. Auth panel local-only warning
9. Support demo labeling (nav, metrics, user link safety)
10. Subnav `aria-current` longest-match fix
11. Security Center scope honesty

## Automation opportunities (not yet built)

- Auto-refresh for SEV pages
- Assign / escalate incident with assignee picker
- Flag change requires typed reason → audit metadata
- Maintenance requires `endsAt` for critical severity
