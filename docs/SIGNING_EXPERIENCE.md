# Signing Experience

**Task:** 032  
**Route:** `/web3/sign`  
**Component:** `SigningExperience`  
**Query:** `?origin=`

## Capabilities

| Capability                 | Status                                          |
| -------------------------- | ----------------------------------------------- |
| Message signing            | Kind selector                                   |
| Typed data signing         | EIP-712 style preview payload                   |
| Transaction signing        | Human-readable summary                          |
| Risk indicators            | Risk chip + unknown-contract warning            |
| Gas estimates              | Placeholder string                              |
| Fee breakdown              | Placeholder string                              |
| Simulation                 | Alert placeholder                               |
| Wallet / network selection | Local selectors                                 |
| Permission summary         | Side panel badges                               |
| Approve / Reject           | Live prepare/confirm best-effort + local status |

## API

- `POST /api/v1/connections/sign/prepare`
- `POST /api/v1/connections/sign/confirm`
- Offline: UI completes with local success/failure micro-interaction

## Related

Advanced lab: `/connections` (full WalletConnect / hardware screens)
