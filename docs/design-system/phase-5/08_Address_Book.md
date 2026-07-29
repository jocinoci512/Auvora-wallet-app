# 08 — Address Book

**Surface:** `/address-book` (`AddressBookExperience`)

## Capabilities

Favorites, labels, notes, groups, search, CRUD dialog, Send deep link, network-aware validation (including ENS / UD-style names on EVM nets).

## Trust

- Format validation before save
- Humanized invalid-address messages
- Placeholder guides `0x… / name.eth / domain.crypto`

## Persistence

Local `listContacts` / `upsertContact` / `deleteContact` — unchanged.

## Next

Import/export JSON, risk assess on save, QR into form, deep-link `/send?to=`.

## Code

`apps/web/src/components/wallet/AddressBookExperience.tsx`
