# 02 — Admin Review

## Critical issues found & fixed

| Issue                                   | Fix                                      |
| --------------------------------------- | ---------------------------------------- |
| Paste-JWT presented as normal auth      | Dev/staging banner + copy                |
| MFA / logout / roles / flags one-click  | `window.confirm` guardrails              |
| Maintenance create-only                 | PATCH end + End notice button            |
| Incidents/alerts read-only              | SDK + Acknowledge/Resolve                |
| Ops subnav missing on incident siblings | OPS_LINKS + PageHeader everywhere needed |
| Capacity/deps JSON dumps                | Tables / structured lists                |
| Filter keystroke API storms             | Search applies filters explicitly        |
| Support demo → live user 404            | Block `usr_demo_*` account links         |
| Support in primary nav unlabeled        | “Support (demo)”                         |
| Subnav multiple `aria-current`          | Longest-prefix match                     |
| Security center oversold                | Explicit “not a SIEM” scope              |
| Overview ignored open incidents         | Surface top incidents + triage link      |

## Consistency

Phase 8 ops/identity/support paths use PageHeader + section nav. Older domains (payments, custody) remain pre-Phase-8 chrome — tracked as remaining risk, not blocking ops criticals.

## Accessibility

- Subnav current-page corrected
- AsyncStates loading/empty/error retained
- Confirm dialogs are minimal (native); custom dialogs later

## Documentation honesty

Phase 8 final report overstated monitoring readiness; this follow-up pack and code fixes align claims with reality.
