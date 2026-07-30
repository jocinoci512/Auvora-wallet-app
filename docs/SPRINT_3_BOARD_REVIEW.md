# Sprint 3 — Security / Product / UX / Engineering Board Review

## Verdict

**CONDITIONAL APPROVE** for closed-beta with labeled pending transfers.

Not unrestricted GA until live derivation + RPC broadcast (Sprint 4). After hardening, the board answers **yes** to first-time safe completion _within the honesty boundary_ (on-device secured pending, not silent on-chain fiction).

## Board questions (post-hardening)

| Question                              | Answer                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| First-time user safely complete a tx? | **Yes** — guided steps, plain-language validation, checklist, auth gate; Receive never shows wrong-network QR |
| Every step reduce fear?               | **Yes** — calm copy, fee/arrival clarity, discard confirm, offline block on submit                            |
| Confirmations prevent mistakes?       | **Yes** — full selectable address, last-6 checklist, self-send extra check, large-amount warn                 |
| QR fast & reliable?                   | **Improved** — noDuplicates, URI+amount parse, error cooldown, Settings deep-link, haptics                    |
| Premium vs leading wallets?           | **Directionally** on safety choreography; live speed TBD with broadcast                                       |

## Weaknesses found → fixed

| Area        | Weakness                                  | Fix                                             |
| ----------- | ----------------------------------------- | ----------------------------------------------- |
| Send UX     | TextEditingControllers recreated in build | Stable controllers                              |
| Send safety | Easy discard mid-flow                     | PopScope + leave confirm                        |
| Send safety | Offline submit                            | Connectivity check; block submit when offline   |
| Review      | Truncated-only address                    | Full selectable address + last-6 checklist      |
| Review      | Self-send optional                        | Extra required checkbox                         |
| Amount      | Fee same-asset edge cases                 | Fee-in-ETH for USDC explained; MAX reserves fee |
| Amount      | Large sends silent                        | ≥50% balance warning                            |
| Auth        | Vague biometric reason                    | Amount in biometric prompt                      |
| Receive     | BTC/SOL QR of EVM fingerprint             | **Hard block** — no QR/copy until derivation    |
| QR          | Weak retry / permission                   | Cooldown, Open Settings, noDuplicates           |
| QR          | Ignored payment URIs                      | Parse scheme + embedded amount                  |
| Validation  | Mixed-case silent                         | Normalize lowercase + last-6 confirm warning    |
| Web         | One-click send after checklist            | `window.confirm` authorize gate                 |

## Remaining (does not block conditional approve)

- Per-network receive addresses (BTC/SOL)
- Real EIP-55 keccak verification library (currently normalize + confirm)
- Live broadcast / fee oracles
- Desktop native camera QR (paste still primary on web)
