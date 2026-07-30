# 01 — Global Product Audit

## Scope

Landing, auth/onboarding, wallets, dashboard, portfolio, send/receive/swap/bridge/buy/sell/stake, NFTs, Web3, settings/security, notifications, help, assistant/insights/learn, admin ops.

## Verdict by domain

| Domain                | Status         | Notes                                  |
| --------------------- | -------------- | -------------------------------------- |
| Marketing / landing   | Pass           | Aether brand intact                    |
| Onboarding / recovery | Pass           | Phase 3 honesty retained               |
| Dashboard / portfolio | Pass           | Sample banners present                 |
| Send / Buy / Sell     | **Fixed**      | Were fake-success; now labeled preview |
| Swap / Bridge         | Pass           | Already preview-quoted                 |
| Staking               | **Fixed**      | Preview when `!live` always            |
| Activity / Devices    | **Fixed**      | Sample banners; revoke gated           |
| Security / biometrics | **Fixed**      | Preference, not live WebAuthn          |
| AI / Insights / Learn | Pass           | Educational posture                    |
| Admin ops             | Pass (staging) | Phase 8 + follow-up                    |
| Admin support         | Demo only      | Hidden from prod nav                   |
| Native stores         | N/A            | Web-only monorepo                      |

## Critical trust issues (resolved in Phase 9)

1. Send receipt claimed “Sent / on its way” with simulated hash
2. Buy/Sell claimed purchase/sale submitted
3. Devices revoked demo sessions as if live
4. Activity looked like live ledger
5. Biometrics toggle implied Face ID worked
6. Access token paste always visible
7. Nested `role="main"` landmarks

## Overall

**Closed-beta / staging preview ready** after honesty fixes. **Not** unrestricted GA until live broadcast, providers, IdP, and store wrappers land (see 14).
