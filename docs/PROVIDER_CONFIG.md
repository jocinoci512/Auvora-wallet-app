# Provider Config (Phase 25)

Env matrix for the blockchain Alchemy primary path. Placeholders only in `.env.example` — never commit real keys.

## Required / recommended variables

| Variable                       | Required                               | Purpose                                                |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------ |
| `BLOCKCHAIN_PRIMARY_PROVIDER`  | No (default `alchemy`)                 | `alchemy` \| `simulator`                               |
| `BLOCKCHAIN_SIMULATOR_ENABLED` | No (default `false`)                   | Local ledger sync timer; must be `false` in production |
| `ALCHEMY_API_KEY`              | Preferred                              | Builds all five mainnet RPC URLs                       |
| `ALCHEMY_ETHEREUM_RPC_URL`     | Optional override                      | Ethereum JSON-RPC                                      |
| `ALCHEMY_BSC_RPC_URL`          | Optional override                      | BNB Smart Chain JSON-RPC                               |
| `ALCHEMY_SOLANA_RPC_URL`       | Optional override                      | Solana JSON-RPC                                        |
| `ALCHEMY_TRON_RPC_URL`         | Optional override                      | Tron RPC / HTTP base                                   |
| `ALCHEMY_BITCOIN_RPC_URL`      | Optional override                      | Bitcoin JSON-RPC                                       |
| `ALCHEMY_RPC_TIMEOUT_MS`       | No (default `12000`)                   | Per-request abort timeout                              |
| `ALCHEMY_REQUIRED`             | Prod default true when primary=alchemy | Fail boot if credentials missing                       |
| `ALCHEMY_LIVE_TEST`            | Tests only                             | Enables gated live Jest suite                          |

## URL construction

When an explicit URL is unset and `ALCHEMY_API_KEY` is set:

```
https://eth-mainnet.g.alchemy.com/v2/{key}
https://bnb-mainnet.g.alchemy.com/v2/{key}
https://solana-mainnet.g.alchemy.com/v2/{key}
https://tron-mainnet.g.alchemy.com/v2/{key}
https://bitcoin-mainnet.g.alchemy.com/v2/{key}
```

Implemented in `services/blockchain/src/infrastructure/providers/alchemy/alchemy-rpc.config.ts`.

## Redaction

`redactRpcUrl()` replaces `/v2/<secret>` with `/v2/[REDACTED]` before logs, metrics labels, and health `endpoint` fields.

## Production guards

- `BLOCKCHAIN_SIMULATOR_ENABLED=true` is rejected in production.
- When Alchemy is required and credentials are missing, boot fails.
- Unauthorized (401/403) responses are not retried.

## Downstream services

Wallet, Swap, NFT, Bridge, Staking, Market Data, and Analytics must continue to use their own ports / blockchain HTTP client — never import Alchemy clients or env keys in those services.
