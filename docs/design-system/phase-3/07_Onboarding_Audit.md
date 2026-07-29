# 07 — Onboarding Audit

## Before → After

| Area    | Before                             | After (Phase 3)                                                |
| ------- | ---------------------------------- | -------------------------------------------------------------- |
| Hub     | 6 equal cards, no welcome          | Welcome → Choose (2 primaries + advanced)                      |
| Create  | Name→network→backup checkboxes→API | Auth→setup→create→phrase educate/verify→security→prefs→success |
| Import  | Phrase-only demo                   | Methods + auth optional + verify + security                    |
| Auth    | JWT paste only                     | Unified method UI + JWT path preserved                         |
| Visual  | `.wx` wallet-experience            | Aether `.ob` onboarding system                                 |
| Anxiety | Technical custody copy             | Reassure + progressive disclosure                              |

## Logic preserved

- `createApiClient().createWallet`
- 401 handling + offline fallback
- `setSecurityPrefs` / `hashPin`
- Phrase normalize + challenge indexes
- Routes under `/wallets/*`

## Remaining gaps

1. Restore / hardware / watch / recovery still on legacy `.wx` shell
2. OAuth / passkeys / WalletConnect are presentation-ready, not provider-wired
3. Demo phrase ≠ production seed (by design)
4. Dual Security Center surfaces still exist post-onboarding

## Score

| Dimension                  | Score                         |
| -------------------------- | ----------------------------- |
| Clarity                    | 8/10                          |
| Anxiety reduction          | 8/10                          |
| Aether consistency         | 8/10                          |
| Completeness of methods UI | 7/10                          |
| Backend auth completeness  | 4/10 (expected — JWT gateway) |
