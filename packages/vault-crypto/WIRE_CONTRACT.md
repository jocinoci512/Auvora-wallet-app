# auvora-vault-v1 wire contract

Canonical encrypted vault envelope shared by Android, Web, Gateway, and Wallet.

## Transport

- Method: `PUT /api/v1/vault`
- Content-Type: `application/json`
- Auth: `Authorization: Bearer <access JWT>`
- Owner identity: JWT `sub` only (never trust a body `ownerUserId`)
- Encoding: standard Base64 (not base64url) for binary fields
- Field naming: camelCase JSON

## Required fields

| Field                   | Type   | Notes                                                             |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| algorithmId             | string | Must be `auvora-vault-v1`                                         |
| version                 | int    | Must be `>= 1` (currently `1`)                                    |
| epoch                   | int    | Must be `>= 1`. First upload: `1`. Updates must strictly increase |
| kdfSalt                 | string | Base64, length ≥ 8                                                |
| kdfParams               | object | Argon2id params object                                            |
| recoveryKdfSalt         | string | Base64, length ≥ 8                                                |
| recoveryKdfParams       | object | Argon2id params object                                            |
| wrappedVaultKey         | string | Base64 AES-GCM blob (`iv\|\|tag\|\|ct`)                           |
| wrappedVaultKeyRecovery | string | Base64 AES-GCM blob                                               |
| ciphertext              | string | Base64 AES-GCM blob                                               |
| aad                     | string | Exact form: `auvora-vault-v1\|<ownerUserId>\|<epoch>`             |

## Optional fields

| Field    | Type        | Notes                                                                      |
| -------- | ----------- | -------------------------------------------------------------------------- |
| deviceId | string UUID | Must be `devices.id` UUID. **Do not** send fingerprints (`and-…`, `web-…`) |

## Forbidden fields

- password / passphrase
- mnemonic / seed / recovery phrase plaintext
- private key plaintext
- any unknown property when Wallet ValidationPipe has `forbidNonWhitelisted: true`

## AAD binding

`aad` must include the authenticated owner user id. Wallet rejects envelopes whose AAD does not contain `ownerUserId`.

## First upload

When no row exists for the owner, epoch `1` is accepted. Stale/equal epochs are rejected only when a row already exists.

## Gateway

Gateway must reverse-proxy body/headers/auth unchanged to Wallet (`/api/v1/vault`).
