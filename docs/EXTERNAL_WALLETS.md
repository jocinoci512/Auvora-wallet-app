# External Wallets

**Phase:** 23  
**Service:** `@auvora/connections-service` (port **3016**)

## Connection kinds

| Kind            | Signing | Notes                                   |
| --------------- | ------- | --------------------------------------- |
| `HARDWARE`      | Yes     | Device pairing + on-device confirmation |
| `WALLETCONNECT` | Yes     | Session-based dApp connectivity         |
| `BROWSER`       | Yes     | Injected wallet discovery/connect       |
| `READONLY`      | **No**  | Watch addresses only                    |

## Browser wallets

- List: `GET /api/v1/connections/browser`
- Connect: `POST /api/v1/connections/browser/connect` `{ providerId }`
- Account discovery and address import flow through the provider adapter

## Read-only / watch addresses

- Add: `POST /api/v1/connections/watch` `{ network, address, label? }`
- List: `GET /api/v1/connections/watch`
- Remove: `DELETE /api/v1/connections/watch/:watchId`

Watch addresses support portfolio/NFT/tx/price tracking flags in product UX; signing is rejected with `CONNECTIONS_SIGNING_NOT_ALLOWED`.

## Unified connections list

`GET /api/v1/connections` returns all `ExternalWalletConnection` rows for the user across kinds.
