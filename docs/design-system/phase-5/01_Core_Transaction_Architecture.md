# 01 — Core Transaction Architecture

**Design language:** Aether (Phases 1–4)  
**Principle:** Refine — do not restart.

## Mental model

Users think in verbs: **Send · Receive · Swap · Buy · Sell · Stake · Bridge · Review**.

Every verb uses the same chrome:

| Layer                 | Responsibility                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| `TransactionShell`    | Atmosphere, title, reassure copy, optional step progress                     |
| `CxActions`           | Back / primary Continue with loading state                                   |
| `CxProgressTrack`     | Pending → Broadcast → Confirming → Completed (or bridge Lock → Relay → Mint) |
| `humanizeError`       | Maps chain/API noise into plain guidance                                     |
| `core-experience.css` | Mist / Lagoon tokens, confirm cards, keypad, QR, timeline                    |

## Lifecycle (all money verbs)

1. Compose
2. Review (fees + warnings visible)
3. Explicit confirm
4. Progress (live / polite)
5. Receipt or humanized failure

## Non-negotiables

- Do not strip blockchain / trading API integrations
- Do not invent a second visual language
- Prefer improving shared primitives over per-screen forks
- Fees and risk before broadcast

## Code map

- Shell: `components/transaction/TransactionShell.tsx`
- Styles: `app/core-experience.css`
- Validation / names / explorers: `lib/wallet-experience/validation.ts`
- Risk: `lib/wallet-experience/security-prefs.ts`
- Trading client: `lib/trading/api.ts` + `activity.ts`
