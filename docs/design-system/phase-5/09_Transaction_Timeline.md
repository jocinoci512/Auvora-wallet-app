# 09 — Transaction Timeline

**Surface:** `/activity` (`TransactionHistoryExperience`)

## Redesign

Migrated from legacy `wallet-experience.css` / `wx-*` to **TransactionShell + `core-experience.css`**.

## Features

- Day-grouped timeline
- Status badges: pending / confirmed / failed / dropped
- Filters: status, type, **network**, deferred search
- Detail panel: hash, fee, from/to, explorer
- CSV export
- Merges wallet demo + trading activity + NFT activity

## Status model

Pending · Confirming (shown as pending until confirmed) · Completed · Failed — aligned with filter vocabulary users understand.

## Code

- `apps/web/src/components/wallet/TransactionHistoryExperience.tsx`
- `apps/web/src/app/activity/page.tsx`
