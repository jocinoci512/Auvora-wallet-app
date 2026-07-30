# Sprint 4 — Digital Asset Engine

## Verdict

Flutter and web now share one Digital Asset Engine surface for **Buy · Sell · Swap · Bridge · Stake**: shared quotes, fee lines, status stages, auth gate, receipts, and honest simulator labeling until live providers connect.

## Features completed

**Flutter (primary)**

- Unified `DigitalAssetFlowScreen` for all five operations (configure → review checklist → biometric/PIN → status track → receipt)
- Shared quote simulator (`QuoteEngine`) with expiry timers and auto-refresh
- Shared UI: `EngineQuoteCard`, `EngineStatusTrack`, `EngineReceiptView`, `engineAuthenticate`
- Home actions wired: Swap / Buy primary; Sell · Bridge · Stake in More sheet
- Portfolio balances + Activity updated locally on successful submit (double-submit guarded)

**Web companion**

- Shared `quote-engine.ts` + `QuotePanel` / `QuoteChecklist`
- Buy & Sell rebuilt on shared quotes (fees, expiry, checklist, status stages)
- Swap confirm adds fee checklist + shared status labels
- Error humanization covers expired quotes / liquidity / price movement

## Architecture

| Layer                       | Location                                            |
| --------------------------- | --------------------------------------------------- |
| Models                      | `apps/mobile/lib/engine/models.dart`                |
| Quote + fees                | `apps/mobile/lib/engine/quote_engine.dart`          |
| Submit / status / portfolio | `apps/mobile/lib/engine/engine_controller.dart`     |
| Shared UI                   | `apps/mobile/lib/ui/engine/engine_shared.dart`      |
| Unified flow                | `apps/mobile/lib/ui/engine/digital_asset_flow.dart` |
| Web quotes                  | `apps/web/src/lib/trading/quote-engine.ts`          |
| Web quote UI                | `apps/web/src/components/trading/QuotePanel.tsx`    |

Provider code is a string field (`auvora-sim` today) so MoonPay / Ramp / DEX / bridge adapters can swap without redesigning the UI.

## Security

- Every submit requires biometric **or** PIN (`engineAuthenticate`)
- Fee + details checklist before auth
- Expired quotes blocked at submit; double-submit rejected
- No private keys or payment credentials in quotes / receipts
- Simulator banner always visible until live rails

## Performance

- Quote refresh is local O(1) math with short artificial delay
- 1s UI timer for expiry; auto-refresh on expiry in configure phase
- Web Buy/Sell recompute quotes on input change without remote chatter in preview mode

## Honesty / readiness

This is a **preview Digital Asset Engine**. Quotes, fees, and status progression are simulated. Live on-ramps, DEX liquidity, bridge settlement, and staking broadcast remain Sprint 5.

Board posture after hardening: **conditional approve** for invite-only labeled preview — see `docs/SPRINT_4_BOARD_REVIEW.md`.

## Sprint 5 remaining

1. Provider adapters (MoonPay / Ramp / etc.) behind the same quote interface
2. Live swap routing + broadcast; real slippage oracles
3. Bridge providers with claim / refund paths
4. On-chain stake / unstake / claim with pending withdrawals
5. Per-network derivation (carryover) for accurate receive + bridge destinations
