# Auvora Premium Web + One Ecosystem Reconstruction Report

**Date:** 2026-08-02  
**Workspace:** `D:\auvora-wallet`  
**Production reference:** https://auvorawallet.com/  
**Scope:** Product reconstruction of `apps/web` (+ shared/backend only where needed), preserving mobile Reown/Alchemy work  
**Commit/push:** **NOT performed** (per instructions)

---

## Executive summary

This sprint rebuilt the web companion as part of **one Auvora ecosystem**: honest marketing, a premium authenticated shell with intelligent IA (HOME / MONEY / WALLETS / WEB3 / INSIGHTS / SECURITY / ACCOUNT), account auth foundation, Reown web↔mobile pairing foundation, price failover labeling, and truthful Security/Devices surfaces.

**PASS for safety gates:** no plaintext keys server-side in this work, `liveBroadcastEnabled=false` on web+mobile, NFT product absent (redirects only), no secrets committed, no commit/push.

**PARTIAL for live product depth:** web portfolio balances remain demonstration until authenticated watch/live addresses are bound; Reown web pairing is foundation + session restore (live Universal Provider relay still needs `NEXT_PUBLIC_WC_PROJECT_ID` + provider package); encrypted cross-device wallet-secret sync is intentionally a **separate security milestone**.

---

## 1. Full web route audit (matrix)

**Crawl count:** 88 `page.tsx` routes under `apps/web/src/app` (post-rebuild).

| Path                                                                     | Class                   | Status                          | Notes                                                 |
| ------------------------------------------------------------------------ | ----------------------- | ------------------------------- | ----------------------------------------------------- |
| `/`                                                                      | REFINE                  | DEMO marketing                  | Calm premium homepage preserved; false claims removed |
| `/auth/login`, `/auth/register`                                          | **NEW**                 | BETA                            | Account identity — never seeds                        |
| `/dashboard`                                                             | KEEP                    | DEMO                            | Demo holdings + live price failover label             |
| `/portfolio`                                                             | KEEP                    | DEMO                            | Explicit sample holdings                              |
| `/market/portfolio`                                                      | **MERGE**               | redirect → `/portfolio`         |                                                       |
| `/activity`, `/activity/:txId`                                           | REFINE                  | DEMO                            | Does not wipe mobile activity                         |
| `/send`                                                                  | REFINE                  | DEMO                            | Broadcast OFF                                         |
| `/receive`                                                               | REFINE                  | DEMO                            | Funding locked                                        |
| `/swap`, `/bridge`, `/buy`, `/sell`, `/staking`                          | COMING_SOON             | DEMO                            | ComingSoonPanel + preview UI                          |
| `/wallets*`                                                              | KEEP/REFINE             | BETA/DEMO                       | API when JWT present                                  |
| `/web3/pair`                                                             | **NEW**                 | BETA                            | Mobile pairing foundation                             |
| `/web3/*`, `/connections`                                                | REFINE                  | DEMO/BETA                       | Sim/preview WC shaped                                 |
| `/settings/*`                                                            | KEEP                    | DEMO/BETA                       | Honest Security/Devices                               |
| `/security`                                                              | **MERGE**               | redirect → `/settings/security` |                                                       |
| `/nfts*`, `/digital-assets`                                              | REDIRECT                | ABSENT                          | → `/dashboard`                                        |
| `/custody*`, `/compliance*`, `/payments*`, `/blockchain*`, `/analytics*` | REMOVE from consumer IA | BETA ops                        | Hidden from primary IA                                |

Full pre-rebuild audit (85 routes) informed classification; see agent exploration notes in sprint working session.

---

## 2. Homepage premium quality

**Direction preserved:** “The quiet operating system for digital value.” Brand-first hero, calm atmosphere, WalletPreview, Syne/Manrope typography.

**Refined:** spacing/hierarchy retained; demo portfolio labeled; no fake testimonials; networks split Supported vs Coming soon; Alpha honesty in CTAs/FAQ/security grid.

**Gate:** **PASS (refined, not redesigned into neon/casino).**

---

## 3. False / premature claims removed

Removed or reclassified:

- One-click swaps / staking / hardware / encrypted cloud backup / web biometrics as live
- Institutional “audit-ready” social proof theater
- Fake testimonials (Maya / Jordan / Elena)
- Avalanche / Base / Arbitrum / Optimism claimed as supported → **Coming soon**
- Fabricated metrics / user counts — explicitly avoided (“0 Fabricated user counts”)

---

## 4. Premium authenticated web app shell + IA

Implemented `AppChrome` (`components/Nav.tsx`) with:

- Marketing nav on `/`, `/auth/*`, `/legal/*`, `/trust`, `/design-system`
- App sidebar IA sections: HOME, MONEY, WALLETS, WEB3, INSIGHTS, SECURITY, ACCOUNT
- Honesty badges (Demo / Beta / Soon)
- Mobile menu bar ≤900px
- Only real or honestly labeled features exposed in IA (no NFT)

---

## 5. One Auvora account experience

| Capability          | Status                                                                              |
| ------------------- | ----------------------------------------------------------------------------------- |
| Register / login UI | **BETA** — `/auth/register`, `/auth/login` via `@auvora/sdk` → gateway auth         |
| Session token       | Access JWT in `sessionStorage` (`auvora_access_token`); refresh cookie path via SDK |
| Syncable (safe)     | Identity, prefs, public addresses/labels/watch-only/activity metadata/sessions      |
| **Never synced**    | Private keys, mnemonic, recovery phrases                                            |

Mobile vault auth remains device-local (PIN/biometrics). Linking mobile vault ↔ account without uploading keys remains future work.

---

## 6. Self-custody cross-device architecture + threat model

### Architecture (foundation this sprint)

```
[Android vault] --keys stay here--> Reown WalletKit
       ^                                |
       | approve/sign                   | WC session (public Project ID)
[Web companion] --account JWT--> Auth/Me/Devices/Prefs
                --pairing UI----> local session store (no Secret)
```

Encrypted restoration of wallet secrets across devices: **NOT SHIPPED**. Account/device foundation only.

### Threat model (honest)

| Threat                             | Mitigation / residual                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Server exfiltrates seed            | Seeds never accepted by production APIs; web forms are rehearsal only      |
| XSS steals access JWT              | Tab-scoped sessionStorage; short TTL; refresh httpOnly — residual XSS risk |
| Reown Secret in browser            | Forbidden — only `NEXT_PUBLIC_WC_PROJECT_ID` (public)                      |
| User pastes real mnemonic into web | Education + Alpha warnings; treat as user error residual                   |
| Fake “synced” wallets              | Devices UI states account sessions ≠ key sync                              |
| Relay MITM                         | Rely on Reown/WC protocol when live; preview sessions labeled              |

**Milestone:** end-to-end encrypted wallet-secret sync with recovery UX + threat review — separate from this sprint.

---

## 7. Web ↔ Mobile pairing (same Reown project)

- Same Cloud project as Android `WC_PROJECT_ID`
- Web uses `NEXT_PUBLIC_WC_PROJECT_ID` only (documented in `.env.example`)
- Keys remain on mobile
- UI: `/web3/pair` — URI pair, restore, disconnect, preview sessions

---

## 8. Reown web integration

| Capability                          | Status                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| QR / URI pairing UX                 | **PASS** foundation                                                                         |
| Session list / disconnect / restore | **PASS** local store                                                                        |
| Live Universal Provider relay       | **PARTIAL** — requires configured public Project ID + provider wiring (not shipping Secret) |
| Reown Secret in browser             | **NO**                                                                                      |
| Mobile WalletKit                    | **Protected** — not regressively edited this sprint beyond pre-existing WIP                 |

---

## 9. Real portfolio via Alchemy/RPC + prices

| Layer                     | Status                                                        |
| ------------------------- | ------------------------------------------------------------- |
| Alchemy backend           | **LIVE** (prior verification report; not redesigned)          |
| Web holdings              | **DEMO** labeled — sample holdings until live address binding |
| Prices                    | **BETA** — CoinGecko → CoinCap → cache; seeded never silent   |
| Alchemy Prices in browser | Not client-keyed (correct); server path when available        |

---

## 10. Activity unified architecture

- Web activity remains companion/preview
- Mobile on-device activity authoritative; **not wiped**
- No destructive sync that clears mobile history introduced

---

## 11. Send

- Premium multi-step UI retained
- `liveBroadcastEnabled=false` — confirm does not broadcast
- Primary actions prefer Pair mobile for signing path

---

## 12. Receive

- Network/token selection + warnings retained
- `allowFundingAddresses=false` — QR/copy/share locked
- Demo addresses only

---

## 13. Security Center honesty

- Web biometrics factor forced **not OK** / labeled “Mobile biometrics (not on web)”
- No fake WebAuthn unlock claim
- Score copy updated to exclude false web biometric claims

---

## 14. Devices & Sessions

- Professional UI retained
- Copy clarifies: account sessions ≠ encrypted wallet-secret sync
- Demo fallback labeled when `/api/v1/me/*` unavailable

---

## 15. Responsive quality

- Sidebar desktop; mobile bar + panel ≤900px
- Marketing homepage existing responsive CSS retained
- Prefer-reduced-motion respected in new chrome

---

## 16. Design system primitives

- Continued use of `@auvora/ui` (`AppShell`, `ThemeToggle`, alerts, etc.)
- New primitives: `FeatureStatusBadge`, `ComingSoonPanel`, shell CSS tokens aligned to Auvora teal/ink

---

## 17. Motion

- Marketing Reveal / reduced-motion hooks retained
- Shell transitions disabled under `prefers-reduced-motion`

---

## 18. Accessibility

- Skip link retained
- FAQ accordion ARIA retained
- Sidebar `aria-current`, mobile `aria-expanded`
- **WCAG certification not claimed** (no formal audit this sprint)

---

## 19. Performance

- Next production build succeeded with route-level code splitting
- Price fetch timeouts (8s); API GET retry utilities retained
- Skeletons retained on existing experiences

---

## 20. Error experience

- Auth surfaces API errors via `formatApiError`
- Offline/online provider retained
- Pairing messages for missing Project ID / invalid URI
- Price source labels when failover/cache/seeded

---

## 21. Status page

- Existing `/status` health page retained — no fake PoR/user/volume metrics added

---

## 22. NFT absent

- Product IA: no NFT links
- Routes `/nfts*`, `/digital-assets` still redirect to dashboard
- **Gate: PASS (absent from product)**

Residual: `services/nft` monorepo package / seed perms may still exist backend-side (decommission backlog) — not reintroduced in web IA.

---

## 23. Protect mobile work

- Flutter analyze: **No issues found**
- Flutter tests: **+121 All tests passed**
- Reown mobile implementation not rewritten/removed this sprint
- Broadcast remains `false` on mobile

---

## 24. Testing results

| Check                | Result                               |
| -------------------- | ------------------------------------ |
| Web unit tests       | **20 passed** (8 suites)             |
| Web typecheck        | **PASS**                             |
| Web lint             | **PASS** (0 errors; warning cleaned) |
| Web production build | **PASS** (exit 0)                    |
| Flutter analyze      | **PASS** — No issues found           |
| Flutter tests        | **PASS** — `+121: All tests passed!` |

---

## 25. Programmatic route crawl (post-rebuild)

88 routes enumerated (see §1). Notable **new**: `/auth/login`, `/auth/register`, `/web3/pair`. Notable **merged**: `/security` → `/settings/security`, `/market/portfolio` → `/portfolio`. NFT redirects preserved.

Broken routes found in crawl of page modules: **0 compile/build failures**.  
Dead buttons (intentional Alpha locks): Receive QR/copy/share; Send confirm non-broadcast; Coming soon trading confirms — counted as **intentional**, not product defects.

Estimated remaining misleading CTAs in deep ops pages (`/custody`, `/payments`): present but **out of consumer IA** — backlog to hide behind admin flag.

---

## 26. Key pages rebuilt / removed / merged

### Rebuilt / new

- Homepage claims honesty
- App shell + IA
- `/auth/login`, `/auth/register`
- `/web3/pair`
- Dashboard primary actions
- Security Center / Devices honesty
- Swap/Bridge/Buy/Sell/Staking Coming soon wrappers

### Merged

- `/security` → `/settings/security`
- `/market/portfolio` → `/portfolio`

### Removed from consumer IA (not deleted ops)

- Analytics, custody, compliance, payments, blockchain consoles
- NFT product (already redirected)

---

## FINAL GATES

| Gate                                      | Verdict                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| HOMEPAGE PREMIUM QUALITY                  | **PASS**                                                                           |
| WEB APP DESIGN CONSISTENCY                | **PASS** (shell + badges)                                                          |
| ALL IMPORTANT ROUTES AUDITED              | **PASS**                                                                           |
| BROKEN ROUTES count                       | **0** (build)                                                                      |
| DEAD BUTTONS count                        | **Intentional Alpha locks** (Receive funding / broadcast) — not counted as defects |
| WEB AUTH                                  | **PARTIAL/BETA** (login UI + SDK; needs live gateway for E2E)                      |
| MOBILE AUTH                               | **PASS** (device vault; analyze/tests green)                                       |
| ONE ACCOUNT FOUNDATION                    | **PASS** (identity layer; no key sync)                                             |
| WEB/MOBILE ECOSYSTEM                      | **PARTIAL** (pairing foundation; not full live relay E2E)                          |
| REOWN WEB                                 | **PARTIAL** (foundation; Project ID gated)                                         |
| REOWN MOBILE                              | **PASS** (protected; tests green)                                                  |
| ALCHEMY                                   | **PASS** (unchanged verified backend)                                              |
| REAL PORTFOLIO DATA                       | **PARTIAL** (demo holdings + live prices when APIs allow)                          |
| ACTIVITY                                  | **PARTIAL** (web demo; mobile preserved)                                           |
| SEND                                      | **PASS as Alpha preview** (broadcast OFF)                                          |
| RECEIVE                                   | **PASS as Alpha locked**                                                           |
| PRIVATE KEYS STORED PLAINTEXT SERVER-SIDE | **NO**                                                                             |
| LIVE BROADCAST                            | **NO** (web+mobile false)                                                          |
| NFT                                       | **ABSENT**                                                                         |
| WEB TESTS                                 | **PASS** (20)                                                                      |
| WEB PRODUCTION BUILD                      | **PASS**                                                                           |
| FLUTTER ANALYZE                           | **PASS**                                                                           |
| FLUTTER TESTS                             | **PASS** (+121)                                                                    |

---

## Major blockers / next milestones

1. **Live Reown web relay** — add Universal Provider / AppKit with public Project ID only; E2E pair with Android WalletKit.
2. **Live web portfolio** — bind watch/public addresses → Alchemy/RPC balances without implying custody.
3. **Encrypted cross-device wallet-secret sync** — separate security milestone with formal threat model + UX.
4. **Hide ops consoles** behind admin flag (`/custody`, `/payments`, `/analytics`, `/blockchain`).
5. **Optional BFF cookie session** — reduce paste-JWT / sessionStorage XSS surface.

---

## Confirmations

- **No plaintext private keys / seeds stored server-side** by this reconstruction.
- **Live broadcast remains OFF** (`apps/web` + `apps/mobile`).
- **NFT product remains ABSENT** from IA (redirects only).
- **No secrets committed** (only `.env.example` public Project ID placeholder documented).
- **No git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" / push** performed at end of sprint.

---

## Feature classification cheat sheet

| Feature                               | Classification          |
| ------------------------------------- | ----------------------- |
| BTC/ETH/SOL/BNB/Polygon/Tron          | Supported               |
| Avalanche/Base/Arbitrum/Optimism      | Coming soon             |
| Swap/Bridge/Buy/Sell/Staking/Hardware | Coming soon             |
| Encrypted backup sync                 | Coming soon (milestone) |
| Web biometrics                        | Absent                  |
| NFTs                                  | Absent / removed        |
| Live broadcast                        | Absent (kill switch)    |
