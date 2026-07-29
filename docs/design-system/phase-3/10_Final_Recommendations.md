# 10 — Final Recommendations

## Shipped (Phase 3)

- Aether welcome + choose hub
- Full create journey with auth, recovery, security, prefs, success
- Import methods + verification + security
- Specs 01–09 in this folder
- Business logic preserved (`createWallet`, prefs hashing, phrase helpers)

## Next (priority)

1. **Wire real auth providers** behind existing method IDs (passkey, OAuth, magic link)
2. **Migrate restore/hardware/watch/recovery** onto `OnboardingShell`
3. **Unify Security Center** (`/security` + settings) post-onboarding
4. **Product tour** route for success secondary CTA (currently `/dashboard`)
5. **Formative test** with first-time crypto users — measure completion without help
6. **Hardware + WalletConnect** real pairing beyond simulated continue

## Definition of done (aspirational)

A first-time user creates a wallet without external help; a professional does not feel talked down to; security optional steps never block; motion respects reduced-motion; Aether tokens remain the only paint.
