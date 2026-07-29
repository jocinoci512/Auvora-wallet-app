# Recovery Experience

**Task:** 029  
**Primary route:** `/wallets/recovery`  
**Also:** import `/wallets/import`, restore `/wallets/restore`

## Security posture

| Rule                    | Behavior                                                   |
| ----------------------- | ---------------------------------------------------------- |
| No unnecessary exposure | Reveal toggle required before phrase is shown              |
| No persistence          | Demo phrases live in React state only for the session      |
| No API mnemonics        | Aligns with `docs/WALLET_ENGINE.md` (public metadata only) |
| Education first         | Warnings + checklist before display                        |
| Verification            | Random word challenges                                     |
| Confirmation checklist  | Alone / write offline / never share                        |

## Screens

1. **Secure warnings** — environment + sharing acknowledgements
2. **Education** — order matters, offline storage, support never asks
3. **Display** — numbered grid, hide/reveal
4. **Confirm** — bridge to verification
5. **Verify** — challenge inputs
6. **Success** — link to Security PIN setup

## Import / restore differences

- **Import** assumes user already has a phrase; clears textarea after finish
- **Restore** can practice with a disposable generated phrase

## Custody note

Ledger `restoreWallet` / custody recovery **contacts** are different concepts. This UX is the consumer recovery-phrase product surface that production should bind to HSM/custody workflows without streaming secrets to the browser.
