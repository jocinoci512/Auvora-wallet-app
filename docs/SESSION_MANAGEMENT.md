# Session Management

**Phase:** 26 (extends Phase 23 WalletConnect sessions)

## Session types

1. **WalletConnect / provider sessions** — `WalletConnectSession`  
   Create → approve/reject → restore → terminate / expire
2. **dApp connection requests** — `DappConnectionRequest`  
   Pending proposals that become sessions on approve
3. **Trusted dApp relationships** — `TrustedDapp`  
   Durable trust metadata for origins (independent of a single session)

## Capabilities

- Multiple active sessions per user
- Session restoration (`POST .../walletconnect/sessions/:id/restore`)
- Session expiration (TTL via `CONNECTIONS_SESSION_TTL_SECONDS`)
- Session termination
- dApp request expiration (status `EXPIRED`)
- Permission grant expiration tied to sessions / explicit `expiresAt`

## Restoration

`restoreSession` rehydrates an encrypted session topic through the provider port.  
dApp permission grants remain bound by origin; restoring a session does not auto-regrant revoked permissions.

## Expiration

Session monitor worker (`SESSION_MONITOR`):

1. Marks `ACTIVE` WalletConnect sessions past `expiresAt` as `EXPIRED`
2. Calls `expireStaleRequests()` for pending dApp connection requests
3. Calls `expireStalePermissions()` for grants past `expiresAt`

## Encryption

WalletConnect URI / topic material continues to use the connections field-encryption adapter.  
Activity metadata stores payload **hashes**, never raw private keys or seed material.

## User / admin views

- User summary: `GET /api/v1/connections/dapps/sessions/summary`
- Admin sessions: `GET /api/v1/admin/connections/sessions`  
  Includes `dappPendingRequests` and `trustedDapps`
- Web UI: Session manager + connection history
- Admin UI: Session dashboard + worker monitoring

## Replay protection

Each connection request requires a unique `proposalNonce`. Reuse raises `ConnectionsReplayError` (HTTP 409).
