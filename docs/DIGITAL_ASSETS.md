# Digital Assets

**Phase:** 21 — NFT & Digital Asset Management Platform

## Asset lifecycle

1. **Discover** — provider returns `NftAssetSnapshot[]` for an owner address
2. **Persist** — upsert `NftAsset` + `NftOwnership` + collection
3. **Metadata** — sanitize traits / URLs; refresh on demand or via worker
4. **Media cache** — image / animation / video entries in `NftMediaCache`
5. **Verify** — ownership verifier confirms owner still holds the token
6. **Gallery** — search, filter, sort, favorites, hidden

## Media

| Kind      | Source fields  | CSP                            |
| --------- | -------------- | ------------------------------ |
| IMAGE     | `imageUrl`     | `img-src` allows https + CDN   |
| ANIMATION | `animationUrl` | iframe with empty `sandbox`    |
| VIDEO     | `videoUrl`     | `media-src` allows https + CDN |

Remote scripts are never executed from metadata. Metadata sanitizer strips HTML/script payloads.

## User preferences

- Favorites: `NftOwnership.isFavorite`
- Hidden: `NftOwnership.isHidden` (excluded from gallery unless `includeHidden=true`)

## Bitcoin readiness

Bitcoin appears in network capabilities with `nftSupported: false` and a documented reason. Schema and provider port remain network-agnostic so Ordinals / artifacts can plug in later without breaking APIs.

## Admin surfaces

- Provider dashboard
- Collection dashboard
- Metadata status (ready / pending / failed)
- Worker health
- Synchronization metrics (avg duration, failures)

## Web / Admin routes

- Digital Assets hub: `http://localhost:3000/digital-assets` (Task 031)
- Web gallery: `http://localhost:3000/nfts`
- Asset detail: `http://localhost:3000/nfts/assets/:id`
- Collection: `http://localhost:3000/nfts/collections/:network/:slug`
- NFT activity: `http://localhost:3000/nfts/activity`
- Admin: `http://localhost:3001/nfts`

## Product experience (Task 031)

Premium UX lives in `apps/web/src/components/nft/*` with `nft-experience.css`. The hub covers NFTs, collectibles, tokenized placeholders, cross-chain summaries, and portfolio deep-links. Live APIs remain Phase 21; offline demo data keeps workflows usable. See [`NFT_EXPERIENCE.md`](./NFT_EXPERIENCE.md).
