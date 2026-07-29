# Transaction History

**Task:** 029  
**Route:** `/activity`  
**Component:** `apps/web/src/components/wallet/TransactionHistoryExperience.tsx`

## Capabilities

| Feature           | Implementation                                      |
| ----------------- | --------------------------------------------------- |
| Filtering         | Status + direction selects                          |
| Searching         | Deferred query across hash, asset, addresses, notes |
| Grouping          | Day buckets via `groupActivityByDay`                |
| Status indicators | `@auvora/ui` `StatusBadge`                          |
| Fee display       | Native fee + USD when present                       |
| Hash display      | Full hash in detail panel                           |
| Explorer links    | External link per tx                                |
| Export            | CSV download (`exportActivityCsv`)                  |
| Detail view       | Inline detail panel (hash, fee, from/to, explorer)  |

## Data source

- Default: curated `DEMO_ACTIVITY` when live ledger/chain lists are unavailable
- Optional `initial` prop for future wiring to `getWalletTransactions` / `listChainTransactions`

## Performance

- `useDeferredValue` for search input
- List virtualization not required at demo scale; CSV export is O(n) client-side
- Lazy QR is isolated to Receive (not history)

## Accessibility

- Toolbar uses `role="search"`
- Rows are focusable buttons opening a labelled detail region
- Status text remains visible (not color-only)

## Related

- Dashboard recent txs remain demo widgets on `/`
- Chain ops list remains at `/blockchain/transactions` for admin-style tooling
