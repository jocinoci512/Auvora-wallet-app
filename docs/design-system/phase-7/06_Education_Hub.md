# 06 — Education Hub

## Purpose

Beginner-friendly learning inside Auvora — fundamentals without jargon-first copy.

## Surface

- **Route:** `/learn`
- **Component:** `apps/web/src/components/learn/EducationHubExperience.tsx`
- **Catalog:** `LEARN_TOPICS` in `lib/insights/demo.ts`

## Topics (Phase 7 catalog)

Wallet Basics · Security · Scam Prevention · Gas Fees · Layer 2 · Staking · DeFi · NFTs · Networks · Recovery

Each card: category, ~minutes, summary, deep link into product or Assistant.

## UX

- Search + category chips
- PlatformCardLink grid (interaction containers only)
- Primary action: Ask Assistant; secondary: Help & FAQ

## Relationship to Help Center

Help (`/settings/help`) remains operational FAQ / support. Learn is curriculum. Both cross-link.

## Quality gates

| Gate                      | Status |
| ------------------------- | ------ |
| Beginner-friendly         | Pass   |
| Searchable                | Pass   |
| Mobile chip scroll / grid | Pass   |
