# Signing Workflows

**Phase:** 23  
**Service:** `@auvora/connections-service` (port **3016**)

## Confirm-before-sign flow

1. **Prepare** — `POST /api/v1/connections/sign/prepare`

```json
{
  "kind": "HARDWARE",
  "connectionRef": "device-or-session-id",
  "network": "ETHEREUM",
  "payloadType": "TRANSACTION",
  "payload": "…",
  "feeEstimate": "0.001"
}
```

Returns preview, fee estimate, network validation, and `requestId`. Status: `PENDING_CONFIRMATION`.

2. **Confirm** — `POST /api/v1/connections/sign/confirm`

```json
{ "requestId": "…", "confirmed": true }
```

Reject with `confirmed: false` (confirmation required error).

3. **Verify** — Engine checks provider result, encrypts signature at rest, emits analytics/notification/AI events.

## Guarantees

- Read-only connections cannot sign
- Provider simulation must succeed (`simulationOk`)
- Replay / request identity via `providerRequestId`
- Failed signs enqueue `ConnectionRetryJob`
- Signature ciphertext never logged

## History

`GET /api/v1/connections/sign/requests` lists recent external signing requests (signatures encrypted).
