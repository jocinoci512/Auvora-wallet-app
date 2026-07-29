# NFT Engine

**Phase:** 21 — Enterprise NFT & Digital Asset Management Platform  
**Service:** `@auvora/nft-service` (port **3014**)

## Overview

The NFT Engine discovers, synchronizes, and manages digital assets across Ethereum, BNB Smart Chain, Solana, and Tron, with architectural readiness for Bitcoin digital artifacts.

Clients call the gateway (`/api/v1/nfts`). Business logic depends only on the `NftProviderPort` abstraction — never on a specific vendor SDK.

## Capabilities

| Capability        | Endpoint / service                            |
| ----------------- | --------------------------------------------- |
| Networks          | `GET /api/v1/nfts/networks`                   |
| Discover & sync   | `POST /api/v1/nfts/discover`                  |
| Gallery           | `GET /api/v1/nfts/gallery`                    |
| Asset detail      | `GET /api/v1/nfts/assets/:assetId`            |
| Favorite / hide   | `PATCH .../favorite`, `PATCH .../hidden`      |
| Ownership verify  | `POST .../verify-ownership`                   |
| Metadata refresh  | `POST .../refresh-metadata`                   |
| Collections       | `GET /api/v1/nfts/collections`                |
| Collection detail | `GET /api/v1/nfts/collections/:network/:slug` |

## Standards

- Ethereum: ERC-721, ERC-1155
- BNB Smart Chain: BEP-721, BEP-1155
- Solana: SPL NFTs
- Tron: TRC-721-style where supported
- Bitcoin: capability stub (`nftSupported: false`) for future artifacts

## Workers

Gated by `NFT_WORKERS_ENABLED`:

- NFT sync worker
- Metadata worker
- Image / media cache worker
- Ownership verifier
- Collection updater
- Retry queue

## Security

- Safe metadata parsing / sanitization (no remote code execution)
- CSP-aware media loading (`img-src` / `media-src`)
- Input validation via DTOs + Zod env
- Field encryption key: `NFT_FIELD_ENCRYPTION_KEY`

## Integrations

Fire-and-forget publishers when URLs are configured: Notifications, Analytics, AI, Observability. Optional Wallet / Blockchain / Market Data URLs for enrichment.
