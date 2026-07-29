# dApp Browser

**Task:** 032  
**Route:** `/web3/browser`  
**Component:** `DappBrowserExperience`

## Capabilities

| Capability            | Status                                                   |
| --------------------- | -------------------------------------------------------- |
| Address bar           | HTTPS normalize + Go                                     |
| Secure URL validation | `isSecureDappUrl` — HTTPS public hosts only              |
| Bookmarks             | Local upsert/remove (`prefs`)                            |
| History               | Local visit stack (50) + optional `POST …/browser/visit` |
| Back / Forward        | In-session navigation stack                              |
| Refresh               | Re-navigate active URL                                   |
| Open external         | `target=_blank` with `rel=noopener`                      |
| Multi-tab             | Placeholder copy (single session)                        |
| Loading               | Skeleton stage                                           |
| Error pages           | EmptyState + phishing/HTTPS warning                      |

## Security

- Non-HTTPS and localhost blocked in the address bar
- iframe `sandbox` + `referrerPolicy=no-referrer`
- Many dApps set `X-Frame-Options`; sandboxed preview may be blank — external open remains available

## Performance

- Visit logging is fire-and-forget
- History/bookmarks read lazily from `localStorage`
- Loading indicator uses short CSS skeleton (respects `prefers-reduced-motion`)
