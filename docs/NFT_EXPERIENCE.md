# NFT Experience

**Task:** 031 — Premium NFT Gallery & Digital Assets  
**App:** `apps/web`  
**Figma:** Canonical file [Auvora Design System](https://www.figma.com/design/<YOUR_FIGMA_FILE_KEY>) — Task 031 frame on **Trading Experience** page (Starter plan page limit prevents a fourth page)

## Surfaces

| Flow               | Route                                | Component                 |
| ------------------ | ------------------------------------ | ------------------------- |
| Digital Assets hub | `/digital-assets`                    | `DigitalAssetsHub`        |
| Gallery            | `/nfts`                              | `NftGalleryExperience`    |
| Asset detail       | `/nfts/assets/[assetId]`             | `NftDetailExperience`     |
| Collection         | `/nfts/collections/[network]/[slug]` | `NftCollectionExperience` |
| NFT activity       | `/nfts/activity`                     | `NftActivityExperience`   |

## Architecture

- Reuses Phase 21 NFT gateway APIs (`/api/v1/nfts/*`) via `lib/nft/api.ts`
- Demo fallbacks in `lib/nft/demo.ts` when offline
- Local prefs: recently viewed, wallet labels (`lib/nft/prefs.ts`)
- Shared media viewer (`NftMediaViewer`) + `nft-experience.css`

## Gallery capabilities

Grid / list / compact / large / collection overview · search · trait search · network & collection filters · favorites · hidden · recently viewed · recently acquired sort · discover & sync

## Related docs

- [`DIGITAL_ASSETS.md`](./DIGITAL_ASSETS.md)
- [`COLLECTIONS.md`](./COLLECTIONS.md)
- [`MEDIA_SUPPORT.md`](./MEDIA_SUPPORT.md)
- [`NFT_ENGINE.md`](./NFT_ENGINE.md)
