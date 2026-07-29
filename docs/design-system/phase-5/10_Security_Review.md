# 10 — Security Review

## Verifications on core flows

| Check            | Implementation                                         |
| ---------------- | ------------------------------------------------------ |
| Recipient format | `validateAddressFormat` + name resolve                 |
| Name recipients  | Preview resolve shown on Send review                   |
| Address risk     | `assessAddressRisk` on Send                            |
| Network          | Explicit selectors + Receive wrong-network warn        |
| Fees             | Always on review before broadcast                      |
| Confirm          | Required for Send / Swap / Bridge / Buy / Sell / Stake |
| Failures         | Swap / Bridge live errors no longer fake-success       |

## Error policy

`humanizeError` covers: auth, reject, locked wallet, network, rate limit, wrong chain, gas, nonce, allowance, balance, slippage, KYC, revert, bridge stuck, checksum; clamps long / hex dumps.

## Residual risk

- Camera QR still paste-assisted (production scanner TBD)
- Name resolve is deterministic client preview — wire live ENS/UD APIs next
- Scam DB beyond local heuristics
- Transaction simulator for contract calls

## Gate: Security Review — Pass (with documented residuals)
