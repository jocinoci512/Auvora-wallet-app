# Network Support

**Status:** Alchemy is the primary infrastructure provider for five enabled mainnets

## Matrix

| Network         | Live Alchemy (primary) | Simulator fallback  | Native | Tokens                            | Notes                                    |
| --------------- | ---------------------- | ------------------- | ------ | --------------------------------- | ---------------------------------------- |
| Ethereum        | Yes                    | Dev only (if unset) | ETH    | ERC-20 via `getTokenBalance`      | Gas via `eth_gasPrice`                   |
| BNB Smart Chain | Yes                    | Dev only            | BNB    | BEP-20 via `getTokenBalance`      | Same EVM provider                        |
| Solana          | Yes                    | Dev only            | SOL    | SPL via `getTokenAccountsByOwner` | `getLatestBlockhash`                     |
| Tron            | Yes                    | Dev only            | TRX    | TRC-20 via HTTP trigger           | Energy/bandwidth estimate                |
| Bitcoin         | Yes                    | Dev only            | BTC    | N/A                               | UTXO via `scantxoutset` (tier-dependent) |
| Polygon         | No                     | Yes                 | MATIC  | —                                 | Simulator only                           |
| Litecoin        | No                     | Yes                 | LTC    | —                                 | Simulator only                           |

## Capability checklist (Alchemy-backed)

Shared across live providers:

- Connection health + RPC availability
- Address validation
- Balance lookup
- Transaction lookup
- Broadcast signed transaction
- Confirmation monitoring (`getConfirmations` / tip delta)
- Fee estimation
- Latest block / tip retrieval
- Network status
- Retry + timeout + graceful failure (`JsonRpcClient`)

### Ethereum / BNB

- Native balances (`eth_getBalance`)
- Token balances (`eth_call` `balanceOf`)
- Gas estimation (`eth_gasPrice` × transfer gas)
- Broadcast (`eth_sendRawTransaction`)
- Confirmations from tip − inclusion block
- Event subscriptions: not required for Phase 17 (sync/health cover watch)

### Solana

- SOL balances (`getBalance`)
- SPL balances (`getTokenAccountsByOwner`)
- Recent blockhash (`getLatestBlockhash`)
- Submission (`sendTransaction`, base64)
- Confirmation via slot delta

### Tron

- TRX balances (JSON-RPC or `/wallet/getaccount`)
- TRC-20 (`triggerconstantcontract`)
- Energy/Bandwidth (`estimateResources` → `/wallet/getaccountresource`)
- Broadcast (JSON-RPC or `/wallet/broadcasthex`)

### Bitcoin

- Address balances (`scantxoutset`; returns `0` if indexer unavailable)
- UTXO retrieval (`getUtxos`)
- Fee estimation (`estimatesmartfee`)
- Broadcast (`sendrawtransaction`)
- Confirmations (`getrawtransaction`)

## Product boundary

Downstream apps (web, admin, wallet service) talk to the **blockchain service HTTP API** only.  
They must not embed Alchemy SDKs or RPC URLs.
