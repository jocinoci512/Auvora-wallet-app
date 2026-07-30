# 01 — Product Review

**Scope:** Phase 6 Security · Settings · Web3 · NFT · Notifications · Help · Personalization  
**Bar:** Apple polish · Stripe interaction honesty · Coinbase-switch comfort

## Verdict

Phase 6 shipped a coherent **PlatformShell** language, but first-pass product quality was **not launch-ready**. Several controls looked finished while behaving incorrectly (tabs, a11y toggles, one-click “verified”, offline signing “success”).

After this follow-up polish pass, Phase 6 is **closer to premium**, with remaining debt documented in `09_Remaining_Recommendations.md`.

## Hard questions

| Question                      | First pass | After polish                        |
| ----------------------------- | ---------- | ----------------------------------- |
| Premium financial product?    | Partial    | Improved                            |
| Apple-level polish?           | No         | Not yet — still UI kit mix          |
| Stripe-honest interactions?   | No         | Improved (signing / backup / score) |
| Coinbase switch comfort?      | Borderline | Better IA + calm copy               |
| Memorable without decoration? | Weak       | Stronger shell + honest score       |
| Beginner-safe?                | Mixed      | Better FAQ / no fake verify         |

## Product principles reinforced

1. Never teach unsafe shortcuts (removed local “Mark verified”).
2. Never claim success when the network was unreachable (signing).
3. Never ship dead accessibility knobs.
4. Settings home must be searchable if we say it is.
5. Security Center links to PIN — PIN must speak the same Aether language.
