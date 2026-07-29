# Buy / Sell UI

## Buy — `/buy`

**Component:** `BuyExperience`

| Capability                        | Notes                                 |
| --------------------------------- | ------------------------------------- |
| Card purchase                     | Method chip                           |
| Bank transfer                     | ACH-style chip                        |
| Third-party providers             | MoonPay / Ramp / Stripe / ACH catalog |
| Fee transparency                  | Method-specific fee labels            |
| Compliance messaging              | KYC / risk Alert                      |
| Confirmation + progress + success | Screen machine                        |
| Purchase history                  | Demo list + link to `/payments`       |

Architecture is production-ready for wiring to payments providers without changing ledger APIs.

## Sell — `/sell`

**Component:** `SellExperience`

| Capability             | Notes                         |
| ---------------------- | ----------------------------- |
| Asset selection        | Balance-aware chips           |
| Destination account    | Bank / card / USD balance     |
| Fee breakdown          | ~0.9% illustrative            |
| Settlement estimate    | Per destination               |
| Confirmation + history | Screen machine + demo history |

Both flows push entries into trading activity for portfolio/activity integration.
