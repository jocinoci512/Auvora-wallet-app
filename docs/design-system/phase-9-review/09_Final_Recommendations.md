# 09 — Final Recommendations

## Do now (quality only — no feature sprawl)

1. Keep all money success states live-gated (done for Send/Buy/Sell/Swap/Bridge/Stake).
2. Replace `auvora.example` privacy/support contacts before any public URL.
3. Run staging smoke: auth → wallet → live swap/send when APIs up.
4. Freeze marketing language to “preview / closed beta.”

## Prioritized remediation to flip NO GO → GO

### P0

1. Live transaction broadcast + buy/sell providers; simulators false in prod
2. Published Privacy, Terms, Status, Support contacts
3. Admin SSO
4. Pen-test + secrets rotation + CSP enforce
5. Restore drill / backup alerts

### P1

6. E2E critical journeys + Lighthouse CI
7. Support ticket domain or permanent removal from operate IA
8. ConfirmSheet for destructive actions
9. WCAG automated suite

### P2

10. Unify portfolio chrome to `cx-*`
11. Native wrappers only after P0

## Explicitly do not do

- Add speculative features to “feel more launch-ready”
- Submit App Store / Play builds of a demo wallet
- Claim financial-advice AI or live settlement prematurely
