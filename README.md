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

## Deploy (Vercel)

1. **Supabase** — create a project and run [`supabase/schema.sql`](./supabase/schema.sql) once in the
   SQL editor (creates the `runs` / `run_skills` / `run_events` tables with RLS). Persistence is
   required in production: serverless invocations don't share memory, so reports won't survive without it.
2. **Import the repo into Vercel** and set the environment variables below in Project Settings.
3. Set **`NEXT_PUBLIC_SITE_URL`** to the production URL (drives OG tags, the sitemap, and robots).
4. The per-skill route declares `maxDuration = 60` — confirm your plan allows a 60s function duration.

### Environment variables

| Variable | Needed for | Purpose |
|---|---|---|
| `LLM_PROVIDER` | production | `gemini` or `grok`; defaults to `stub` (canned analyses) |
| `GEMINI_API_KEY` | `gemini` | Google Gemini key |
| `XAI_API_KEY` | optional | xAI Grok key — enables automatic rate-limit failover |
| `NEXT_PUBLIC_SUPABASE_URL` | production | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | production | server-only key the store uses (bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | production | canonical URL for OG / sitemap / robots |
| `BROWSERLESS_TOKEN` | optional | live screenshots (UX + QA) |
| `TAVILY_API_KEY` | optional | web search (Market Researcher) |
| `GITHUB_TOKEN` | optional | higher public-repo read limits |
| `NEXT_PUBLIC_NOVUS_KEY` | optional | loads the Pendo / Novus analytics agent |

See [`.env.example`](./.env.example) for the full list (including optional model/host overrides).

## Status

Runs end-to-end — live analysis on real evidence (your code and deployed pages) via Gemini, with
results persisted to Supabase and a real-time dashboard. Without provider keys it falls back to
deterministic stub data so you can run it locally with zero setup. See
[`ACKNOWLEDGEMENTS.md`](./ACKNOWLEDGEMENTS.md) for the open standards and ideas this builds on.
