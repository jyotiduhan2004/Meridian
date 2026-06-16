---
name: skill-name-in-kebab-case
description: >-
  Load when <the real situation that should trigger this skill — name the inputs
  and keywords, ≤ ~50 words>. Do not load when <the obvious false-trigger>.
specialist: <PM | UX Designer | QA Engineer | Market Researcher | Security Engineer | DevOps Engineer | Investor>
tier: <P0 | P1 | P2>
inputs: [<url | repo | description | hackathon_context — whichever this skill needs>]
version: 0.1
---

# <Skill title>

> One or two sentences: what this skill produces and why it matters. Write for the
> agent that will run it, not for a human reader.

## When this runs
- The inputs it needs are present (else the orchestrator marks it **skipped**, not failed).
- <any mode/condition, e.g. "Product Mode only" or "Judge Mode only">.

## How to do it (principles, not a script)
Give judgment-guiding principles + a checklist. Prefer "look for X; if Y, it means Z"
over rigid step-by-step. The model handles edge cases better with principles.

1. **<Phase / lens 1>** — <what to look at, what good vs bad looks like>.
2. **<Phase / lens 2>** — …
3. **<Phase / lens 3>** — …

### Checklist
- [ ] <concrete, checkable item>
- [ ] <concrete, checkable item>

## Scoring rubric (X / 10)
| Dimension | Points | What earns them |
|-----------|--------|-----------------|
| <dim> | <n> | <criteria> |
| **Total** | **10** | |

State the stance this skill contributes when relevant: `ship` / `fix-first` / `block`
(the PM uses these to detect team conflicts).

## Output (structured)
Return JSON-ish structured output so the PM can synthesize and the dashboard can render:
```
{ score, rubricBreakdown, findings: [{title, severity, evidence, fix, effort}], stance }
```
Use evidence the user can verify (screenshots, `file:line`, quoted text, cited URLs).

## Gotchas / red flags  (append-mostly — grow this from real failures)
- ❌ <a tempting-but-wrong behavior> → ✅ <the right behavior>.
- ❌ Inventing precise numbers → ✅ give a **directional range with a cited source**.
- ❌ Failing silently → ✅ return partial output + say what was missing.

## References (loaded only when needed — progressive disclosure)
- `references/<topic>.md` — <heavy detail kept out of this file>.
