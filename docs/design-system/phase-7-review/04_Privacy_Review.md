# 04 — Privacy Review

## Verdict

**Pass for on-device Assistant** after removing phantom cloud-chat claims and clearing history on opt-out.

## Critical issues found

1. Privacy + Assistant copy promised optional API chat that is not wired — **removed**.
2. Turning off `aiChatHistory` did not clear `localStorage` — **clears now**.
3. History key centralized (`ASSISTANT_HISTORY_KEY`) for one clear path.

## Controls

| Control             | Behavior                               |
| ------------------- | -------------------------------------- |
| `aiAssistant`       | Disables ask / chips                   |
| `aiChatHistory`     | Off → clear storage; no further writes |
| Clear local history | Explicit wipe + welcome reset          |

## Security messaging

Assistant reassure: no phrases, no fund moves, **no investment advice**. Scam answers remain calm, not panic-inducing.

## Remaining privacy work (non-critical)

- Document retention for future cloud chat before enabling.
- Confirm analytics never includes assistant free-text if analytics on.
