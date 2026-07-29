# Fetch Invocation Fix

**Date:** 2026-07-27  
**Status:** Fixed and re-verified

## Root cause file(s)

| File                                                                           | Role                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **`packages/sdk/src/client.ts`**                                               | **Primary root cause** — wallets list uses this client |
| `services/ai/src/infrastructure/providers/http-openai-compatible.provider.ts`  | Same anti-pattern (prophylactic)                       |
| `services/ai/src/infrastructure/providers/gemini-http.provider.ts`             | Same anti-pattern (prophylactic)                       |
| `services/ai/src/infrastructure/providers/anthropic-http.provider.ts`          | Same anti-pattern (prophylactic)                       |
| `services/notifications/src/application/services/webhook.service.ts`           | Same anti-pattern (prophylactic)                       |
| `services/notifications/src/infrastructure/providers/http-channel.provider.ts` | Same anti-pattern (prophylactic)                       |

## Exact failure

```ts
// packages/sdk/src/client.ts (before)
this.fetchImpl = options.fetchImpl ?? fetch;
// ...
await this.fetchImpl(url, init); // `this` = AuvoraClient → Illegal invocation
```

Call chain: `/wallets` → `createApiClient()` → `AuvoraClient.listWallets()` → unbound `fetch`.

## Exact fix applied

```ts
this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
```

Provider getters updated to:

```ts
return globalThis.fetch.bind(globalThis) as unknown as FetchLike;
```

## Regression coverage

`packages/sdk/src/client.test.ts` asserts method-style invocation keeps `globalThis` as `this`.
