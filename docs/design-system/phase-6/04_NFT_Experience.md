# 04 — NFT Experience

**Gallery:** `/nfts` (`NftGalleryExperience`)  
**Detail / collection / activity:** existing routes preserved  
**`/digital-assets`:** redirects to `/nfts`

## Features

- Grid / list / compact / large / collection views
- Search, traits, sort, favorites, hide spam, recently viewed
- Live gallery API + demo fallback
- Detail: metadata, traits, transfer/share affordances (existing)
- Verified collection cues via demo/API flags

## Shell

PlatformShell “Collectibles” for Aether chrome; gallery grid keeps `nft-experience.css` (hybrid) so media layouts stay intact.

## Code

`components/nft/NftGalleryExperience.tsx` · `lib/nft/*`
