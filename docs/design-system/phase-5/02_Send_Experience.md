# 02 — Send Experience

**Surface:** `/send` (`SendExperience`)

## Flow

1. Asset — search, network, balance, fiat estimate
2. Recipient — address, ENS / Unstoppable-style names, paste, QR entry, address book, risk heuristics
3. Amount — keypad, Max / %, available + remaining + fiat
4. Fee — slow / standard / fast / custom
5. Review — confirmation card with resolved name destination when applicable
6. Progress — Pending → Broadcast → Confirming → Confirmed
7. Success — hash, network-aware explorer, activity link, share / reset

## Trust refinements

- `resolveNamePreview` + `isNameLikeRecipient` so names are accepted (not rejected as invalid `0x`)
- Review shows **Resolves to (ENS / Unstoppable Domains)** before send
- Clipboard denial explained in plain language
- `explorerUrlFor(network, hash)` instead of hard-coded Etherscan
- High-risk addresses use alert styling; medium use warn

## Preserved

Demo balances, fee tables, address-book usage, simulated broadcast.

## Code

`apps/web/src/components/wallet/SendExperience.tsx`
