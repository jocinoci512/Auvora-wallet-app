# 03 — Web3 Hub

**Surfaces:** `/web3`, `/web3/browser`, `/web3/permissions`, `/web3/sign`, `/web3/activity`

## Features

- Featured / recent / favorites / trending / categories
- Pending connection requests (approve / reject)
- Browser with bookmarks & history
- Permission manager + revoke
- Signing review with risk copy + `humanizeError`
- Activity filters

## Architecture

All Web3 experiences use `PlatformShell` + `Web3SectionNav`. Business logic (`web3Fetch`, DEMO catalog, prefs) preserved. Browser chrome uses inline / `cx-*` (no `web3-experience.css` dependency).

## Code

`components/web3/*Experience.tsx` · `lib/web3/{api,demo,prefs}`
