# Auvora Internal QA Lab

LOCAL QA ONLY. Never production. Never mainnet broadcast.

## Blockchain

| Lane            | Network                         | Chain ID  | Daily QA      |
| --------------- | ------------------------------- | --------- | ------------- |
| **Internal QA** | **Auvora Local EVM QA** (Anvil) | **31337** | **YES**       |
| External smoke  | Ethereum Sepolia                | 11155111  | Optional only |
| Production      | Ethereum Mainnet                | 1         | **DISABLED**  |

Public faucets are **not** required for routine QA. Fund the existing device
address with `scripts/qa/fund-local-wallet.ps1` (`anvil_setBalance`).

Custody boundary:

- Samsung encrypted vault remains the only signing-key source
- Server / Gateway / Admin / Anvil funding path never receive the user private key
- Anvil may hold its own deterministic faucet accounts; those are **not** the Auvora vault key

## Email

| Lane               | Provider                                                          |
| ------------------ | ----------------------------------------------------------------- |
| **LOCAL EMAIL QA** | Mailpit (`:1025` SMTP, `:8025` UI) + `mailpit-email-bridge.mjs`   |
| PRODUCTION EMAIL   | **NOT YET CONFIGURED** (SES / Postmark / Resend / SendGrid later) |

## KYC

| Lane         | Provider                                         |
| ------------ | ------------------------------------------------ |
| **LOCAL QA** | `local-identity-simulator`                       |
| PRODUCTION   | Real commercial KYC vendor — **deployment gate** |

## Scripts

```powershell
powershell -File scripts/qa/start-auvora-qa-lab.ps1
powershell -File scripts/qa/check-auvora-qa-lab.ps1
powershell -File scripts/qa/start-local-evm.ps1
powershell -File scripts/qa/fund-local-wallet.ps1
powershell -File scripts/qa/start-local-mail.ps1
```

Destructive reset is explicit only: `scripts/qa/reset-local-evm.ps1`.
