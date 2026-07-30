# Sprint 4 — Board Review (post-hardening)

## Verdict

**CONDITIONAL APPROVE** for invite-only / labeled preview of the Digital Asset Engine.

**Not approved** for unrestricted public GA or marketing as a live on-ramp / DEX / bridge until provider rails and broadcast exist.

Within the honesty boundary (preview quotes, biometric/PIN auth, fee checklists, no fake explorer links), the board answers **yes** to cohesive trust for closed beta.

## Board questions

| Question                          | Answer                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Trust thousands / millions today? | **No for live money.** **Yes for preview choreography** — users are never told funds moved when they did not.         |
| Fees transparent?                 | **Yes** — line items + total before auth; plain labels (“Service fee”, “Network fee (estimated)”).                    |
| Confirmations reassuring?         | **Yes** — amount checklist, irreversible checks for sell/bridge, auth gate, leave confirm, offline block.             |
| Unnecessarily technical?          | **Reduced** — “price protection” not “slippage bps”; “Auvora preview” not `auvora-sim`; no fake Etherscan on preview. |
| Can flows be simpler?             | Shared one-screen engine already; Max + debounced quotes cut friction without removing safety.                        |
| One cohesive platform?            | **Yes** — one Flutter flow + shared web quote/checklist/status vocabulary across Buy→Stake.                           |

## Weaknesses found → fixed

| Area        | Weakness                      | Fix                                     |
| ----------- | ----------------------------- | --------------------------------------- |
| Honesty     | Provider code / fake explorer | Preview labels; explorer only when live |
| Safety      | No balance check              | Block review/submit; Max button         |
| Safety      | Offline submit                | Connectivity check; block authorize     |
| Safety      | Easy leave mid-flow           | PopScope + discard dialog               |
| Safety      | Duplicate quote reuse         | Consumed quote IDs                      |
| Trust       | Large amounts silent          | ≥50% / ≥$1k warning                     |
| Swap        | Silent quote drift            | ≥2% receive delta warning               |
| Bridge/Sell | Irreversible underplayed      | Extra required checkbox                 |
| Fees        | “Provider fee / est.” jargon  | Plain fee copy                          |
| Stake       | Stake-only                    | Stake / Unstake / Claim + beginner copy |
| Status      | Fake completed Activity       | Preview txs marked Pending              |
| Receipt     | Raw doubles / misleading done | Formatted amounts + preview banner      |
| Web         | One-click authorize           | `window.confirm` + shared checklists    |
| Auth        | Awkward prompt                | Clear amount-based reason               |

## Remaining (does not block conditional approve)

1. Live MoonPay / Ramp / DEX / bridge adapters
2. On-chain stake / unstake / claim
3. Real explorer URLs per network
4. Persistent staking reward history beyond preview

## Release posture

Invite-only · labeled **Preview** · Sprint 5 for live rails.
