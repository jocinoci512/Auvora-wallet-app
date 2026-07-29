# Collections

**Task:** 031 collection UX  
**Route:** `/nfts/collections/[network]/[slug]` and gallery `view=collection`

## Experience

| Element        | Notes                                                         |
| -------------- | ------------------------------------------------------------- |
| Banner         | Gradient + collection logo                                    |
| Statistics     | Item count, owners, floor (placeholder), volume (placeholder) |
| Recently added | Asset grid deep-linking to detail pages                       |
| Verified mark  | Shown when `verified` is true                                 |
| Filter gallery | Link back to `/nfts` scoped to collection                     |

## Data

Live: `GET /api/v1/nfts/collections` and `GET /api/v1/nfts/collections/:network/:slug`  
Offline: curated `DEMO_COLLECTIONS` with demo assets from `DEMO_GALLERY`

## Management

Collection management ops remain on the admin `/nfts` dashboard and Phase 21 workers — see [`COLLECTION_MANAGEMENT.md`](./COLLECTION_MANAGEMENT.md).
