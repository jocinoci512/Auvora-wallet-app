# Media Support

**Task:** 031 NFT media UX  
**Component:** `apps/web/src/components/nft/NftMediaViewer.tsx`  
**Helpers:** `apps/web/src/lib/nft/media.ts`

## Supported kinds

| Kind         | Detection                     | Rendering                      |
| ------------ | ----------------------------- | ------------------------------ |
| Image        | `imageUrl`                    | `<img loading="lazy">`         |
| Animated GIF | `.gif` on image/animation URL | Image element                  |
| Video        | `videoUrl`                    | `<video controls playsInline>` |
| Animation    | `animationUrl` (non-gif)      | Sandboxed `<iframe>`           |
| Audio        | `audioUrl`                    | Placeholder + cover art        |
| 3D model     | `modelUrl`                    | EmptyState + cover art         |
| Unknown      | none                          | Unsupported media EmptyState   |

## Safety

- Animation iframes use empty `sandbox` (no scripts)
- Images use `referrerPolicy="no-referrer"`
- Placeholders: `/nft-placeholder.svg`
- Metadata sanitization remains in NFT service (Phase 21)

## Performance

- Lazy loading + `decoding="async"`
- Gallery cards use `content-visibility: auto`
- No remote script execution from metadata
