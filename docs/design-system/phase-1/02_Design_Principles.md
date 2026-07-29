# 02 — Design Principles

**System:** Aether  
**Use:** Decision filter for designers and engineers. If a proposal violates these, revise it.

---

## 1. One job per screen

Every view answers a single question:

> What does the user need **right now**?

If a second job appears, it belongs on another screen, a sheet, or progressive disclosure — not a second card row.

**Test:** Cover the UI with your hand except the primary action. Is the purpose still obvious?

---

## 2. Clarity over cleverness

Prefer plain hierarchy to novel layouts.  
Prefer labels over icons-only.  
Prefer numbers users can trust over decorative charts that dominate.

Clever is allowed only when it reduces steps without reducing understanding.

---

## 3. Whitespace is structure

Empty space is not “unfinished.” It is the grid that makes money readable.

- Prefer fewer regions with more air
- Prefer 8-point rhythm over arbitrary `0.85rem` gaps
- If removing a border / shadow / radius does not hurt understanding, remove it

**Cards are not the default.** Cards exist for interactive containers and grouped decisions — not for decoration.

---

## 4. Typography is navigation

Size, weight, and position tell users where to look before color does.

1. Primary figure (balance, amount)
2. Primary action
3. Supporting context
4. Metadata last

Never compete with the balance using equally loud headlines.

---

## 5. Trust is visible, not theatrical

Security UX:

- Show **what** will happen in human language
- Show **network, asset, fee, and destination** without requiring expansion
- Use calm color for risk — red means stop, not “crypto aesthetic”

No fake vault animations. No fear-mongering copy. No security theater badges.

---

## 6. Speed is a feeling

Optimize for _perceived_ performance:

- Optimistic UI where safe
- Skeletons that match final layout
- Count-up only when it aids comprehension
- Never block the whole screen for a partial fetch

Fast software feels intentional. Slow software feels untrustworthy.

---

## 7. Motion explains change

Animate state changes users must notice:

- Sheet presentation
- Balance updates
- Confirmation → success

Do not animate decoration. Respect `prefers-reduced-motion`.

---

## 8. Progressive disclosure by altitude

| Altitude     | Default density                     | Extra power                         |
| ------------ | ----------------------------------- | ----------------------------------- |
| Beginner     | One path, glossary on demand        | Advanced settings hidden            |
| Intermediate | Compact lists, recent recipients    | Shortcuts appear                    |
| Professional | Dense tables, multi-wallet switcher | Full detail always one gesture away |

Adaptation is density and copy — not a separate product skin.

---

## 9. Platform honesty

- **Mobile:** Native app grammar (bottom primary nav, large targets, thumb zones)
- **Desktop:** Terminal grammar (sidebar, keyboard, denser tables)
- **Tablet:** Hybrid — sidebar optional, touch-first controls

Do not shrink a desktop dashboard onto a phone.

---

## 10. Consistency compounds trust

One radius scale. One type scale. One button hierarchy. One confirmation pattern.

Local “premium” CSS dialects (parallel panel systems) are debt. Aether forbids them going forward.

---

## Principle checklist (PR / design review)

- [ ] Single primary purpose
- [ ] Primary action unmistakable
- [ ] No decorative card chrome
- [ ] Type hierarchy carries scanning
- [ ] Irreversible steps are explicit
- [ ] Loading / empty / error states designed
- [ ] Motion is purposeful; reduced-motion safe
- [ ] Tokens only — no one-off hex or magic spacing
- [ ] Works for beginner _and_ does not insult professional
- [ ] Passes WCAG AA intent (see `09_Accessibility.md`)

Fail any critical item → revise before build.
