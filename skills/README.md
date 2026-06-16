# Skills

Meridian's analyses are implemented as **skills** — folders following the open Agent Skills
convention (`SKILL.md` = YAML frontmatter + body, with optional `references/`). A lightweight
registry indexes the frontmatter; each skill's full body loads only when it runs.

Each skill declares the inputs it needs (`url`, `repo`, `description`), a scoring rubric, and
returns a standard structured result so the product lead can synthesize the findings and the
dashboard can render them uniformly.

## Skills (the demo spine)

| Skill | Specialist |
|-------|-----------|
| `synthesize-verdict` | Product Lead |
| `audit-visual-ux` | UX Designer |
| `walk-user-journey` | QA Engineer |
| `review-code-quality` | QA Engineer |
| `analyze-competitors` | Market Researcher |
| `size-market` | Market Researcher |
| `investor-debate` | Investor |

`_TEMPLATE/` is the starting point for new skills. Further skills (security, devops, pricing,
discoverability, copy, API health, business model, scope) follow the same shape.
