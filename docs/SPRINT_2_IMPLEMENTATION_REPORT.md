# Sprint 2 — Home Dashboard & Portfolio

## What shipped

**Flutter (primary)** — `apps/mobile`

- Post-unlock **HomeShell** with native bottom nav (Home / Assets / Activity / Search / More) and desktop **NavigationRail**
- Home: time-based greeting, security status, notifications entry, **persisted hide balances**, portfolio total + 24h change + 7d trend chart + allocation bar
- Quick actions: Send, Receive, Swap, Buy, Sell, Bridge, Stake (honest “networks connect next” sheets)
- Assets: search, sort, favorites, pin, hide-zero, detail pages with sparklines
- Activity: typed statuses (Pending / Completed / Failed / Cancelled) → transaction detail (hash, fee, parties, copy hash / explorer link / share receipt)
- Global search across assets, networks, transactions, contacts
- Empty portfolio funding CTAs + error/offline/price banners (wired in model)
- Preview balances clearly labeled; toggle empty/sample in More

**Web companion** — `apps/web`

- Dashboard: hide balances (localStorage), hide-zero filter, links to `/assets/[assetId]` and `/activity/[txId]`
- New companion detail routes for assets and transactions

## Architecture

- `PortfolioController` + `PortfolioRepository` (local preview until live chain/price APIs)
- Shared prefs for hide balances / zero / favorites / pins / sort
- Controllers provided at app root so detail routes keep portfolio state
- Charts via lightweight `CustomPaint` (no heavy chart SDK)

## Performance

- `IndexedStack` keeps tabs warm without remount thrash
- Lazy detail routes via `Navigator.push`
- Pull-to-refresh on Home; bounded list rendering on Home (top 4 assets/txs)
- Desktop max-width + rail layout avoids stretching mobile chrome

## Honesty / launch stance

Balances are **local preview** until Sprint 3 network sync. Money actions remain gated with plain-language sheets. Executive **NO GO** for unrestricted GA unchanged.

## Board hardening (post-review)

- 4-tab nav; search as autofocus overlay
- Primary actions reduced to four; Sell/Bridge/Stake in sheet
- Cardless “Your money” hierarchy; quiet preview line
- Desktop two-column Home
- Debug sample toggle buried under More → Preview data
- Semantics + 48px targets; Receive copies address

See `docs/SPRINT_2_BOARD_REVIEW.md`.

## Sprint 3 remaining

1. Live EVM / Solana / BTC derivation + balance sync
2. Wire Send / Receive / Swap / Buy / Sell / Bridge / Stake to real rails
3. Price API with offline cache + true offline/error paths
4. Deep links: explorer launch, system share sheet
5. Push notifications + unread badge
6. Archive leftover NFT service/Prisma models
7. Store / TestFlight builds
