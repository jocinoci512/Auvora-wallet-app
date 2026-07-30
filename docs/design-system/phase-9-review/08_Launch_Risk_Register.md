# 08 — Launch Risk Register

| ID  | Risk                                     | Severity | Likelihood                      | Mitigation                      | Owner     |
| --- | ---------------------------------------- | -------- | ------------------------------- | ------------------------------- | --------- |
| R1  | Users believe preview trades moved funds | Critical | Low after honesty fixes         | Keep banners; E2E copy tests    | Product   |
| R2  | Public launch without live rails         | Critical | Med if rushed                   | **NO GO** until rails live      | Exec      |
| R3  | Placeholder legal / support contacts     | High     | High                            | Publish real URLs/inboxes       | Legal/CS  |
| R4  | Admin JWT / XSS token theft              | High     | Med in misconfig                | IdP; never enable paste in prod | Security  |
| R5  | Support demo treated as live ops         | High     | Med                             | Prod nav hide; ticket domain    | Ops       |
| R6  | Store submission of web-only product     | High     | Low                             | No native apps — hold           | Mobile    |
| R7  | A11y regression without CI               | Med      | Med                             | Add axe CI                      | Eng       |
| R8  | Perf regression without Lighthouse gate  | Med      | Med                             | Add Lighthouse CI               | Eng       |
| R9  | Infra DR unproven                        | High     | Med                             | Restore drill                   | SRE       |
| R10 | Brand damage from overselling            | Critical | Med if marketing ahead of rails | Align GTM with board NO GO      | Marketing |

Critical risks R2, R3, R9, R10 remain open for public launch → board **NO GO**.
