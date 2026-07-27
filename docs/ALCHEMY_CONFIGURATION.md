# Alchemy Configuration

**Phase:** 17  
**Service:** `@auvora/blockchain-service`

## Environment variables

Read **only** from process env (validated by `services/blockchain/src/config/env.schema.ts`).

| Variable | Required | Description |
|----------|----------|-------------|
| `ALCHEMY_API_KEY` | No* | Shared key used to construct default per-chain URLs |
| `ALCHEMY_ETHEREUM_RPC_URL` | No* | Explicit Ethereum JSON-RPC URL |
| `ALCHEMY_BSC_RPC_URL` | No* | Explicit BNB Smart Chain JSON-RPC URL |
| `ALCHEMY_SOLANA_RPC_URL` | No* | Explicit Solana JSON-RPC URL |
| `ALCHEMY_TRON_RPC_URL` | No* | Explicit Tron JSON-RPC / HTTP base URL |
| `ALCHEMY_BITCOIN_RPC_URL` | No* | Explicit Bitcoin JSON-RPC URL |
| `ALCHEMY_RPC_TIMEOUT_MS` | No | Per-request timeout (default `12000`) |

\* At least one of API key or an explicit URL is required to activate live providers.  
In **production**, missing Alchemy config logs a startup warning (soft fail — service still boots on simulators for non-overridden chains).

## URL resolution

Implemented in `resolveAlchemyRpcUrls()`:

1. If `ALCHEMY_<CHAIN>_RPC_URL` is set → use it.
2. Else if `ALCHEMY_API_KEY` is set →  
   `https://<alchemy-host>/v2/<ALCHEMY_API_KEY>`
3. Else → chain stays on the simulator provider.

Default hosts:

| Chain | Host |
|-------|------|
| Ethereum | `eth-mainnet.g.alchemy.com` |
| BNB Smart Chain | `bnb-mainnet.g.alchemy.com` |
| Solana | `solana-mainnet.g.alchemy.com` |
| Tron | `tron-mainnet.g.alchemy.com` |
| Bitcoin | `bitcoin-mainnet.g.alchemy.com` |

## Local setup

1. Copy `.env.example` → `.env` (if needed).
2. Set placeholders only in example files; put the real key in local `.env` (gitignored).
3. Restart the blockchain service so the registry rebuilds.

```bash
# PowerShell example (local only — do not commit)
$env:ALCHEMY_API_KEY = "<your-key>"
pnpm --filter @auvora/blockchain-service dev
```

## Security

- Never commit real keys or populated RPC URLs.
- `.env.example` contains **empty** placeholders only.
- Logs use `redactRpcUrl()` / provider labels — API keys must not appear in log lines.
- Wallet / gateway services must not receive Alchemy env vars for outbound RPC.

## Validation

| Check | Behavior |
|-------|----------|
| Zod schema | Optional URL / key shapes; timeout positive int |
| Production + simulator | Hard fail if `BLOCKCHAIN_SIMULATOR_ENABLED=true` |
| Production + no Alchemy | Warning log; simulators remain for non-live chains |
| Registry boot | Logs which chains activated Alchemy (redacted endpoints) |

## Verification

```http
GET http://127.0.0.1:3003/health/providers
```

Expect `alchemyConfigured: true` and `backend: "alchemy"` for configured chains when RPC responds.
