# Master Build Prompt 2 of 10 — Core Wallet Engine Report

**Date:** 2026-07-30  
**Channel:** Mobile `1.1.0-beta.2` Closed Beta (`DerivationMode.bip32Partial`)  
**Scope:** Multi-chain HD engine, multi-wallet vaults, portfolio/market/search upgrades  
**Status:** Complete for software + Android APK gates on this host; iOS requires macOS

---

## 1. Features completed

| Feature                     | Detail                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BIP32 / SLIP-0010 HD        | `HdDerivation` for BTC (bech32 m/84'), ETH/BNB/Polygon (m/44'/60'), SOL (m/44'/501'), TRX (m/44'/195')     |
| Multi-chain adapter paths   | `PreviewBlockchainAdapter` uses real HD paths via `WalletCrypto.derivationPathFor`                         |
| Multi-wallet vaults         | Indexed secure storage (`auvora_vault_index_v1` + per-id keys); create / import / rename / switch / delete |
| Backup reminders            | `needsBackupReminder` on engine + Home / Account banners                                                   |
| Market provider abstraction | `MarketDataProvider` → CoinGecko + seeded offline failover in `PriceService`                               |
| Chart ranges                | Asset detail 1D / 7D / 30D / 1Y / All via `PriceService.history`                                           |
| Activity filters            | Search + status / type chips; empty filtered state                                                         |
| Global search wallets       | Vault name hits → Account settings                                                                         |
| Account settings            | Real vault management (replaced preview-only inventory for primary actions)                                |

**Kill switches unchanged (intentional):** `liveBroadcastEnabled=false`, `allowFundingAddresses=false`.

---

## 2. Existing features improved

| Area                                   | Improvement                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `WalletCrypto.deriveAddressForNetwork` | Routes to HD when not `previewSha`                                       |
| `SecureKeyStore`                       | Legacy v2 → multi-vault migration                                        |
| `WalletEngine` / `WalletController`    | Multi-vault APIs + rebuild addresses on unlock                           |
| Home dashboard                         | Last-updated timestamp, HD honesty copy, backup reminder in status stack |
| Asset detail                           | Chart ranges, recent txs, copy address with Closed Beta honesty          |
| Activity tab                           | Filter/search UX                                                         |
| Search                                 | Wallets + clearer empty state                                            |
| Help FAQ                               | Multi-wallet answer updated                                              |
| Web portfolio                          | Companion-preview honesty copy                                           |
| Release config                         | `bip32Partial`, funding message updated, marketing `1.1.0-beta.2`        |

---

## 3. Performance optimizations

- Price cache retained; CoinGecko soft-fails to seeded provider without blocking UI forever
- Chart history cached per symbol/range in memory
- Address rebuild only after unlock (not on splash)
- Allocation / hero already cache-first via existing `SyncEngine`

---

## 4. Security improvements

- Per-vault mnemonic isolation in OS secure storage
- Wallet delete / switch / export require existing auth gate
- HD addresses derived on-device; mnemonic never logged
- Funding receive and live broadcast remain fail-closed
- Create-additional-wallet shows phrase once for backup (user must save)

---

## 5. Blockchain integrations verified

| Chain           | Derivation        | Adapter I/O              | Notes                                   |
| --------------- | ----------------- | ------------------------ | --------------------------------------- |
| Bitcoin         | BIP84 bech32      | Preview balances/history | HD address shape verified in unit tests |
| Ethereum        | BIP44 coin 60     | Preview                  | Shared EVM path with BNB                |
| BNB Smart Chain | BIP44 coin 60     | Preview                  | Same account as ETH (MetaMask-style)    |
| Solana          | SLIP-0010 ed25519 | Preview                  | Deterministic base58 pubkey             |
| Tron            | BIP44 coin 195    | Preview                  | Base58Check `T…`                        |
| Polygon         | BIP44 coin 60     | Preview                  | Same EVM account path                   |

**Not yet live RPC/broadcast** — still `PreviewBlockchainAdapter` behind kill switches.

---

## 6. Remaining work (Prompt 3+)

| Priority | Item                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| P0       | Live Ethereum (then BSC/Polygon) `BlockchainAdapter` with audited sign/broadcast |
| P0       | Off-device HD address verification → flip `allowFundingAddresses`                |
| P1       | Argon2id PIN (`v3:`)                                                             |
| P1       | Wire Networks settings to `NetworkManager`                                       |
| P1       | Web portfolio live holdings (stop demo inventing balances)                       |
| P1       | iOS release build on macOS                                                       |
| P2       | Custom tokens / real contract registry                                           |
| P2       | Merge prefs `kDemoPrices` fully into `PriceService`                              |

---

## 7. Android build status

| Check                         | Result                                    |
| ----------------------------- | ----------------------------------------- |
| `flutter analyze`             | **PASS** (info-only prefer_const)         |
| `flutter test`                | **PASS** — 65/65                          |
| `flutter build apk --release` | **PASS** — `app-release.apk` (**74.2MB**) |

---

## 8. iOS build status

| Check                          | Result                                            |
| ------------------------------ | ------------------------------------------------- |
| Project / Info.plist           | Present                                           |
| `flutter build ios` on Windows | **Blocked** — iOS target unavailable on this host |

---

## 9. Web build status

| Check        | Result   |
| ------------ | -------- |
| typecheck    | **PASS** |
| lint         | **PASS** |
| `next build` | **PASS** |

---

## Self-review

- **Senior mobile:** Multi-vault + HD layered onto existing engine — no second engine.
- **Blockchain:** HD is real; balances/broadcast still preview — copy matches that.
- **Product:** Dashboard/activity/search feel complete for Closed Beta without claiming live funds.
- **Security:** Funding/broadcast still locked; vault delete authenticated.
- **QA:** Unit tests cover HD shapes, price failover, kill switches.

**Prompt 3 gate:** Ready after acknowledging iOS host constraint and that live chain I/O remains preview until adapters ship.
