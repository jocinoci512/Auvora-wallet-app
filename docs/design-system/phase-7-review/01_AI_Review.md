# 01 — AI Review

## Verdict

**Useful as an educational companion after fixes.** Not a model-backed advisor — and it must never pretend to be one.

## Principles checklist

| Principle                          | Before                                              | After                                      |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Explains clearly                   | Pass                                                | Pass                                       |
| Never creates unnecessary fear     | Pass                                                | Pass                                       |
| Never gives financial advice       | **Fail** (idle “wise” / yield tone; no buy-refusal) | **Pass** (refusal path + copy scrub)       |
| Distinguishes facts from estimates | **Fail** (cloud chat claim; fake P/L elsewhere)     | **Pass** (honest on-device explainability) |
| Plain language                     | Pass                                                | Pass                                       |
| Maintains privacy                  | Partial                                             | **Pass** (history clear on opt-out)        |
| Supports rather than replaces      | Pass                                                | Pass                                       |

## Critical issues found

1. **Misleading capability:** UI claimed optional signed-in API chat while `/ai` only redirects and Assistant is keyword matching.
2. **Advice creep:** Idle-stable copy (“wise”, “low-risk options”) and soft yield framing.
3. **No advice refusal:** “Should I buy…?” fell through to a generic helpful reply.
4. **Scam regex over-match:** `seed|phrase` inside scam matcher could steal recovery questions (tightened to recovery-first patterns).
5. **aria-live on full transcript:** Re-announced entire chat; now announces latest line only.

## Usefulness (honest)

| Strength                                        | Limit                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| Fast answers for fees, recovery, scams, bridges | Not conversational memory beyond local history |
| Deep links into product                         | Keyword KB, not RAG over user’s portfolio      |
| Calm tone                                       | Cannot answer novel questions accurately       |

## Accuracy posture

Answers are **curated education**. Labels now say so. Do not market as “AI portfolio manager” until live model + retrieval + disclaimers ship.
