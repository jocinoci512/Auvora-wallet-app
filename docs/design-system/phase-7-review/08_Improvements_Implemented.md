# 08 — Improvements Implemented

Critical and high issues from this review — shipped in code before closing the report.

1. **Removed fake unrealized P/L** — show estimate only with cost basis; else “Unavailable”.
2. **Labeled illustrative asset charts** — not live price history.
3. **Honest Assistant explainability** — on-device guides only; no phantom cloud chat.
4. **Financial-advice refusal** path for buy/sell/invest prompts.
5. **Scrubbed advice-toned insight copy**; estimate / not-recommendation language.
6. **Gated insights** (stables, stakeable, permissions reviewed).
7. **Health score honesty** — removed free “reviewed recently”; permissions live-gated on visit.
8. **Empty-holdings Math.max guard**.
9. **Human insight badges** (“Worth a look”, etc.).
10. **Education Hub real lessons** + Crypto Fundamentals topic; Read flow.
11. **Privacy: clear history when chat history off**; centralized history key.
12. **Chat a11y** — polite live line only; reduce-motion scroll.
13. **Smart alerts Preview** labeling + empty state when categories off.
14. **Permissions visit** marks health factor complete.
15. **Portfolio / Insights** client refresh of health after prefs available.

Touchpoints: `lib/insights/demo.ts`, Assistant, Portfolio, Insights, Learn, Privacy, Notifications, PermissionCenter, `core-experience.css`.
