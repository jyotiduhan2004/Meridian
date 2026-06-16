# Meridian

**Find every flaw before your users — and investors — do.**

Meridian is a multi-agent product-analysis tool. Paste your product — a live URL, a public
GitHub repo, a description, or all three — and a team of specialist agents analyzes it in
parallel. They surface what's wrong, the team's product lead reconciles their findings into one
prioritized verdict and an overall score, and an "Investor" agent then challenges you to defend it.

## What it does

- **Smart Intake** — paste anything (even a whole project description); Meridian extracts the
  deployed URL, the GitHub repo, and the description, and confirms before running.
- **A team of specialists**, each owning a set of *skills* (the named analyses):
  - **UX Designer** — visual/UX audit, copy & messaging
  - **QA Engineer** — code quality, a real user-journey walkthrough, API/functional health
  - **Market Researcher** — competitors, market sizing, pricing, discoverability
  - **Security Engineer** — OWASP/secrets/dependency scan, endpoint exposure
  - **DevOps Engineer** — performance, scalability, launch readiness
  - **Product Lead** — business model, scope, and the final synthesis
- **A live dashboard** — watch each skill run in real time.
- **One verdict** — a transparent, weighted score out of 100 plus a prioritized fix list, with
  the reasoning shown (including where specialists disagreed and how it was resolved).
- **The Investor** — an interactive debate that scores how well you defend the product.

## Architecture (short version)

- Skills are folders (`skills/<id>/SKILL.md`) following the open Agent Skills convention — a
  lightweight registry indexes the frontmatter, and each skill's full instructions load only
  when it runs (progressive disclosure).
- A code **orchestrator** plans which skills are eligible from the available inputs and runs
  each as an isolated step; a synthesis stage then produces the verdict.
- Every skill returns the same structured result, so scoring and the dashboard stay uniform.

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · deployed on Vercel. Model-agnostic LLM
layer (Gemini / Grok) · hosted headless browser for UX + QA · web search via Tavily.

## Local development

```bash
npm install
cp .env.example .env.local   # add keys (optional — the app runs on stub data without them)
npm run dev
```

Then open http://localhost:3000.

## Status

Early development. The framework runs end-to-end on stub data; real provider integrations are
being wired in. See [`ACKNOWLEDGEMENTS.md`](./ACKNOWLEDGEMENTS.md) for the open standards and
ideas this builds on.
