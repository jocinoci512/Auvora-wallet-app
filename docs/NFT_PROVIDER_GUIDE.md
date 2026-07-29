# NFT Provider Guide

**Phase:** 21 — NFT & Digital Asset Management  
**Port interface:** `NftProviderPort` (`services/nft/src/domain/nft-provider.port.ts`)

## Abstraction rules

1. Application services inject `NFT_PROVIDER` only.
2. Controllers and UI never import vendor SDKs.
3. New vendors implement `NftProviderPort` and register in `NftProviderRegistry`.

## Built-in providers

| Code              | Role                                     | Networks            |
| ----------------- | ---------------------------------------- | ------------------- |
| `simulator`       | Deterministic local discovery & metadata | ETH, BSC, SOL, TRON |
| `alchemy_nft_sim` | Alchemy-style NFT API adapter (sim)      | ETH, BSC            |
| `helius_sim`      | Helius-style Solana NFT adapter (sim)    | SOL                 |

Enable/disable the simulator with `NFT_SIMULATOR_ENABLED`.

## Implementing a provider

```ts
@Injectable()
export class MyNftProvider implements NftProviderPort {
  readonly code = 'my_vendor';
  readonly name = 'My Vendor';

  getSupportedNetworks() {
    /* ... */
  }
  discoverByOwner(request) {
    /* ... */
  }
  getAsset(network, contract, tokenId) {
    /* ... */
  }
  verifyOwnership(network, contract, tokenId, owner) {
    /* ... */
  }
  getCollection(network, slugOrContract) {
    /* ... */
  }
  listCollections(network) {
    /* ... */
  }
  refreshMetadata(network, contract, tokenId) {
    /* ... */
  }
  healthCheck() {
    /* ... */
  }
}
```

Register in `InfrastructureModule` and add to `NftProviderRegistry` constructor.

## Timeouts & retries

- `NFT_PROVIDER_TIMEOUT_MS` (default 10000)
- `NFT_PROVIDER_MAX_RETRIES` (default 2)

The registry fans out discovery, merges results, and surfaces aggregate health for admin dashboards.

## Failure recovery

Failed metadata / media jobs are written to `nft_retry_jobs` and processed by the retry worker.
