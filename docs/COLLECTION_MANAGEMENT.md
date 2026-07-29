# Collection Management

**Phase:** 21 — NFT & Digital Asset Management

## Model

`NftCollection` stores:

- Network + slug (unique)
- Name, description, logo URL
- Contract address + standard
- Verified flag
- Creator address
- Total supply / owners count
- Floor price USD (placeholder architecture for market-data enrichment)
- Last synced timestamp

## Flows

1. **Discovery** upserts collections from provider asset snapshots.
2. **Collection sync** (`GET /collections?network=`) pulls provider lists and upserts.
3. **Collection view** (`GET /collections/:network/:slug`) returns local row + sample assets, or remote snapshot if not yet persisted.
4. **Admin dashboard** lists recent collections for operators.

## UX

- Web gallery: collection filter + collection tabs
- Collection page: `/nfts/collections/[network]/[slug]`
- Verified collections show a checkmark in UI

## Floor price

`floorPriceUsd` is stored as a decimal placeholder. Market Data Platform integration can populate it without changing the NFT engine contract.
