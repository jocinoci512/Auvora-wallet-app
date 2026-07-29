# 03 — Recovery Phrase Experience

## Importance

This is the **highest-stakes** onboarding surface. Tone: serious, calm, never theatrical.

## Structure (Create path)

1. **Education** — why it matters, what never to do
2. **Reveal gate** — user opts in before words appear
3. **Phrase grid** — numbered mono words (demo phrase for education; production custody does not stream seeds)
4. **Acknowledgements** — written / private / never share
5. **Verification** — 3 random word challenges via `pickChallengeIndexes`

## Preserved helpers

`generateDemoPhrase`, `normalizePhrase`, `pickChallengeIndexes` — `src/lib/wallet-experience/recovery-demo.ts`

## Copy principles

| Do                       | Don’t                        |
| ------------------------ | ---------------------------- |
| “Write these words down” | “Mnemonic / BIP39”           |
| “Support will never ask” | Fear-mongering countdown     |
| “Prove your backup”      | Skip verification by default |

## Warnings

Use Aether `ob-warn` surfaces — amber soft, not red panic — for protective guidance.

## Production note

Live custody never returns raw seed material to the browser (see wallet engine docs). Onboarding rehearses the **habit** and verification pattern; API create remains separate.
