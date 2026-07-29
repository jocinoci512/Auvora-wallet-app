# Web3 Hub

**Task:** 032  
**Route:** `/web3`  
**Component:** `Web3HubExperience`  
**Styles:** `apps/web/src/app/web3-experience.css` (`.w3`)  
**Libs:** `lib/web3/{api,demo,prefs}.ts`

## Purpose

Premium discovery and connection surface for decentralized apps. Curated catalog with live connections-service fallbacks; does not replace `/connections` advanced lab.

## Features

| Feature             | Status                                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| Featured dApps      | Curated `DEMO_DAPPS` + filters                                                        |
| Recently connected  | Recent tab (catalog slice / live summary)                                             |
| Favorites           | `localStorage` via `prefs.toggleFavorite`                                             |
| Trending            | Placeholder filter on `trending` flag                                                 |
| Categories          | DeFi, NFT, Gaming, Social, DAO, Infrastructure, Analytics, Developer Tools, Education |
| Search              | Deferred query across name / origin / category                                        |
| Bookmarks           | Managed in dApp browser; hub links into browser                                       |
| Network filter      | Ethereum / Polygon / Solana                                                           |
| Connection status   | KPI strip (sessions, pending, favorites)                                              |
| Connection requests | Approve / reject (live POST or demo)                                                  |
| Security cues       | Verified / unverified icons + risk chips                                              |

## API

- `GET /api/v1/connections/dapps/sessions/summary`
- `GET|POST /api/v1/connections/dapps/requests…`
- Demo fallback when gateway/connections-service is offline

## Navigation

Section nav: Hub · Browser · Permissions · Signing · Activity  
Primary nav: **Web3** → `/web3` · **Connect lab** → `/connections`

## Related

- [`DAPP_BROWSER.md`](./DAPP_BROWSER.md)
- [`PERMISSION_CENTER.md`](./PERMISSION_CENTER.md)
- [`SIGNING_EXPERIENCE.md`](./SIGNING_EXPERIENCE.md)
- [`SECURITY_UX.md`](./SECURITY_UX.md) (Web3 section)
- Backend: [`WEB3_CONNECTIVITY.md`](./WEB3_CONNECTIVITY.md)
