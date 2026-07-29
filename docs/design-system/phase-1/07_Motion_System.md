# 07 — Motion System

**System:** Aether Motion  
**Inspiration (principles only):** Apple HIG — physical, brief, purposeful  
**Rule:** Motion explains change. It never entertains.

---

## Goals

1. Make state changes legible (open, close, succeed, fail)
2. Preserve spatial continuity (where did this sheet come from?)
3. Feel fast — short durations, minimal travel
4. Respect `prefers-reduced-motion: reduce` universally

---

## Physics

Prefer **spring** for interactive UI; **easing curves** for fades.

| Token           | Type         | Params (guide)                      | Use                          |
| --------------- | ------------ | ----------------------------------- | ---------------------------- |
| `spring.snappy` | spring       | stiffness 520 · damping 40 · mass 1 | Buttons, toggles, icon press |
| `spring.sheet`  | spring       | stiffness 380 · damping 36 · mass 1 | Sheets, drawers              |
| `spring.soft`   | spring       | stiffness 280 · damping 32 · mass 1 | Card expand, large panels    |
| `ease.fade`     | cubic-bezier | `0.22, 1, 0.36, 1`                  | Opacity only                 |
| `ease.standard` | cubic-bezier | `0.2, 0.8, 0.2, 1`                  | Position + fade page enters  |

**Duration caps (when not spring-driven):**

| Token              | ms  | Use                        |
| ------------------ | --- | -------------------------- |
| `duration.instant` | 80  | Color / opacity micro      |
| `duration.fast`    | 160 | Tooltips, hovers           |
| `duration.normal`  | 240 | Page fades, list reorder   |
| `duration.slow`    | 360 | Rare large transitions     |
| Max                | 480 | Hard ceiling in product UI |

---

## Allowed motion vocabulary

| Pattern       | Spec                                                          | When                                         |
| ------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Fade          | opacity 0→1                                                   | Page enter, toast                            |
| Soft rise     | fade + translateY 8→0                                         | Page enter (desktop)                         |
| Sheet present | spring from bottom (mobile) / scale 0.98+fade (desktop modal) | Confirms                                     |
| Sheet dismiss | reverse, slightly faster                                      | Cancel / complete                            |
| Press scale   | scale 0.98 on `spring.snappy`                                 | Primary controls                             |
| Balance tick  | tabular count-up ≤600ms                                       | Balance change user-initiated or first paint |
| Progress      | width/ determinative bar                                      | Send / swap pipeline                         |
| List insert   | fade + 4px rise                                               | New tx appears                               |
| Collapse      | height auto with soft spring                                  | Expandable quote details                     |

---

## Forbidden

- Continuous loop animations on home (except tiny live pip ≤3% attention)
- Bouncy overshoot >1.05 scale
- Parallax on financial screens
- Confetti / particle celebrations for ordinary sends
- Staggered cascades longer than 3 items
- Animating layout thrash during typing

---

## Page transitions

| From → To              | Behavior                                       |
| ---------------------- | ---------------------------------------------- |
| Tab change (BottomNav) | Cross-fade 160–200ms; preserve scroll per tab  |
| Push (mobile stack)    | Horizontal slide 240ms `ease.standard`         |
| Modal / sheet          | As above; backdrop fade 160ms                  |
| Reduce motion          | Instant cut or 80ms fade only — no slide/scale |

---

## Number & balance motion

- Use count-up only for **hero balances** and **confirm amounts**
- Prefer ease-out interpolation; never spring wildly on currency
- If value jumps >50%, cross-fade instead of long count
- Always show final value in accessibility tree immediately

---

## Loading motion

| State                | Motion                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Skeleton             | Soft shimmer 1.2s linear infinite; pause under reduced motion (static pulse opacity 0.7) |
| Spinner              | 0.7s linear rotate; local only                                                           |
| Wallet unlock / boot | Optional lagoon lumen breath once (800ms) then static — no loop                          |

---

## Implementation guidance (future)

- Prefer one motion library aligned with React 19 (e.g. CSS + WAAPI, or a spring lib already accepted by the monorepo)
- Centralize tokens in `@auvora/ui` — no per-experience `@keyframes` duplicates (`wx-fade`, `tx-fade`, …)
- Test on mid-tier Android; drop blur/shimmer if jank >16ms sustained

---

## Review checklist

- [ ] What state change does this explain?
- [ ] Duration ≤ 360ms (or spring settles ~quickly)?
- [ ] Reduced-motion path verified?
- [ ] No motion on decorative background?
- [ ] Focus order still sensible mid-animation?
