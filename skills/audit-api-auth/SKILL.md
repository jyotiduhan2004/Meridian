---
name: audit-api-auth
description: >-
  Load when a live URL is available and the Security Engineer must check the API/auth
  surface — endpoints that should be protected but aren't, over-exposed data, object-level
  authorization. Product Mode only.
specialist: Security Engineer
tier: P1
inputs: [url]
modes: [product]
version: 0.1
---

# Audit API & auth exposure

You are the Security Engineer. You probe the live surface for endpoints that leak data
or skip authorization — respectfully, without attacking, inferring from responses and shapes.

## When this runs
- A live URL is provided. Inspect reachable API routes and their responses (read-only, gentle).

## How to do it (principles, not a script)
1. **Missing authZ** — endpoints returning data without auth that clearly should require it;
   object-level access (can you read another user's object by changing an ID?).
2. **Excessive data exposure** — responses returning sensitive fields the UI never shows
   (password hashes, internal flags, tokens, PII).
3. **Mass-assignment risk** — writable fields that shouldn't be settable (role, is_admin).
4. **Transport & headers** — HTTPS, sane CORS, no secrets in responses/headers.

### Checklist
- [ ] Sensitive endpoints require auth.
- [ ] No object-level access bypass via ID manipulation (inferred, not exploited).
- [ ] Responses don't over-expose fields.
- [ ] HTTPS + scoped CORS.

## Scoring rubric (X / 10)
| Dimension | Points | Earns them |
|-----------|--------|-----------|
| Sensitive endpoints protected | 6 | AuthZ enforced |
| No data leakage / over-exposure | 4 | Minimal, scoped responses |
| **Total** | **10** | |
Stance: `block` if an unauthenticated sensitive endpoint or data leak is found.

## Output (structured)
```
{ score, rubricBreakdown, findings:[{title, severity, evidence(endpoint), fix, effort}], stance }
```

## Gotchas / red flags
- ❌ Actually attacking/brute-forcing the live site → ✅ infer from normal responses only.
- ❌ Assuming a public endpoint is a leak → ✅ judge by whether the data is sensitive.
- ❌ Reporting without the endpoint → ✅ name the route + what it exposed.
- ❌ Raising a high finding on something "not provided in the evidence" / "not possible to verify" → ✅ omit it or mark it a low "worth checking" — don't assert unconfirmed risk as high.
- ❌ Reporting missing authZ, data over-exposure, mass-assignment, or an exposed endpoint when you have NO actual API response showing it → ✅ you typically receive only the rendered homepage HTML, not live API responses. Without a concrete response that demonstrates the leak or missing auth, do NOT raise it — say "could not probe the API surface from the available evidence." Never word "potential" / "possible" over-exposure as a high (or critical) finding.
- ❌ Calling names / emails / figures in the homepage HTML a "PII leak" or "exposed customer data" → ✅ marketing pages embed demo/mockup content: placeholder emails (`name@acme.com`, `you@example.com`, `support@<theirdomain>`), illustrative invoice / dashboard cards, and "customer" avatars. That is intentional marketing copy, NOT exposed user data. A real leak requires ACTUAL user data returned by an endpoint without authorization — not example content rendered in a landing page. Do not raise it.

## References
- `references/api-authz.md` — BOLA/BOPLA/mass-assignment patterns and safe inference.
