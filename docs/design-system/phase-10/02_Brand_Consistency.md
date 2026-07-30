# 02 — Brand Consistency

## Identity

- **Brand:** Auvora
- **Product:** Auvora Wallet
- **System:** Aether (Mist / Lagoon) — Phases 1–6 foundation; do not redesign

## Source of truth

| Asset                    | Location                              |
| ------------------------ | ------------------------------------- |
| Voice & forbidden claims | `apps/web/src/lib/brand/voice.ts`     |
| Design tokens / UI       | `@auvora/ui`, `docs/DESIGN_SYSTEM.md` |
| Legal disclaimer         | `LEGAL_DISCLAIMER` on LegalShell      |

## Voice principles

1. **Calm** — reduce anxiety; never shout
2. **Precise** — say preview / simulator when not live
3. **Honest** — drafts are drafts; status says what’s wrong
4. **Non-advice** — no guaranteed returns, no “financial advice” theater

Preferred terms: recovery phrase, network fee, Review before you confirm, Preview / simulator.

## Visual review

| Element         | Assessment                                         |
| --------------- | -------------------------------------------------- |
| Logo / wordmark | Present in nav; keep hero-level on marketing later |
| Icons           | Shared UI set; avoid emoji as product UI           |
| Typography      | Display + body via Aether CSS variables            |
| Color           | Mist/Lagoon tokens — avoid purple-glow AI defaults |
| Motion          | Respect `reduceMotion`; intentional, not noisy     |
| Illustrations   | Prefer product context over abstract stock         |

## Messaging consistency actions (done)

- Legal / Trust / Status share LegalNav + PlatformShell
- Help and Privacy Center point to in-app legal drafts
- Offline and 404 copy reinforce key custody calm

## Remaining brand debt

- Production domain swap (`auvora.example` → real)
- Email/notification template brand kit
- Marketing landing still needs brand-first viewport rules when built

## Gate

**Brand consistency: Pass** for in-product surfaces; marketing host still outstanding for company-wide claim.
