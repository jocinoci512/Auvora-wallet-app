# Swap Security

**Phase:** 20

## Controls

| Control             | Implementation                                                                        |
| ------------------- | ------------------------------------------------------------------------------------- |
| User confirmation   | `execute.confirmed` must be `true`; prepare returns `requiresUserConfirmation`        |
| Simulation          | Providers set `simulationOk`; prepare rejects failed simulations                      |
| Slippage protection | `minAmountOut` from slippage bps; max slippage capped by `SWAP_MAX_SLIPPAGE_BPS`      |
| Replay / freshness  | Quotes expire (`expiresAt`); prepare rejects expired quotes                           |
| Input validation    | DTO class-validator + domain amount/token checks                                      |
| Output validation   | Positive amounts, differing sell/buy tokens                                           |
| Safe construction   | Unsigned payload only; custody/signing remains outside swap service                   |
| Secrets             | Env-only keys; field encryption key for sensitive payloads                            |
| AuthZ               | JWT + `swap:read` / `swap:execute` / `swap:admin` permissions                         |
| Internal routes     | Gateway denies `/api/v1/internal/**`; swap internal APIs require `x-internal-api-key` |

## Threat notes

- Swap service never holds private keys.
- Clients must confirm before `execute`.
- Provider failures fail closed for that vendor and degrade to remaining healthy providers.
