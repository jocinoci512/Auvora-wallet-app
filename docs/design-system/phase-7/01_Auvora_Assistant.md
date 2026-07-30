# 01 — Auvora Assistant

## Purpose

An in-app companion that explains portfolio concepts, fees, security, recovery, staking, bridges, NFTs, and market terminology in clear, non-technical language. It never replaces decisions or moves funds.

## Surface

- **Route:** `/assistant`
- **Component:** `apps/web/src/components/assistant/AuvoraAssistantExperience.tsx`
- **Knowledge:** `answerAssistant` + `ASSISTANT_PROMPTS` in `lib/insights/demo.ts`
- **Legacy:** `/ai` redirects to `/assistant`

## Capabilities covered

| Domain                        | Behavior                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| Fees / gas                    | Plain-language fee speed trade-offs; links to Send / Learn |
| Recovery                      | Rehearsal guidance; never asks for phrase                  |
| Scams                         | Phishing cues; Security Center / Learn links               |
| Staking / bridge / NFT / swap | Educational summaries + deep links                         |
| Portfolio                     | Concentration and Insights pointers                        |

## UX

- Suggested prompt chips (one tap).
- Chat bubbles with related action links.
- Explainability panel: “How answers are made.”
- Clear local history control.
- Off state when Privacy → Assistant is disabled.

## Privacy & safety

- Respects `aiAssistant` and `aiChatHistory` prefs.
- History stored only in `localStorage` on this device.
- Hard rule in copy: no fund moves, no recovery phrase collection.

## Quality gates

| Gate                            | Status |
| ------------------------------- | ------ |
| Visual (Aether / PlatformShell) | Pass   |
| UX calm / non-overwhelming      | Pass   |
| AI explainability               | Pass   |
| Privacy controls                | Pass   |
| Mobile (scrollable chat, form)  | Pass   |
