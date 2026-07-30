# 04 — Support Platform

## Reality check

There is **no** ticket Prisma model, Nest support service, or admin ticket API. Closest pieces: AI `draftSupportTicket`, notifications broadcast, and consumer Help/Support mailto UX.

Phase 8 therefore ships a **polished, labeled demo** support console so product/ops can evaluate IA — same honesty pattern as Phases 5–7 demos.

## Surfaces

| Route                   | Contents                                               |
| ----------------------- | ------------------------------------------------------ |
| `/support`              | Queue table, open/escalated/CSAT preview metrics       |
| `/support/tickets/[id]` | Case detail, conversation/notes, escalate/note preview |
| `/support/kb`           | Agent knowledge articles (not AI RAG)                  |
| `/support/templates`    | Response templates (fees, verify, CSAT)                |

All pages show a **Demo data** warning. Metrics are not live.

## Intended production path

1. Add `SupportTicket` / `SupportNote` / `SupportArticle` models + Nest module.
2. Replace `apps/admin/src/lib/support-demo.ts` with SDK methods.
3. Hook user verification to `/users/[id]` (already linked).
4. Persist CSAT and SLA timers; retain audit of agent actions.

## Distinction

| Surface         | Purpose                |
| --------------- | ---------------------- |
| `/support/kb`   | Human agent KB         |
| `/ai/knowledge` | AI RAG sources         |
| Web `/learn`    | Consumer education hub |
