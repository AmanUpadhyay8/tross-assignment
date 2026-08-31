# Tross LinkedIn Profile API + Test UI

An HTTP API that accepts a LinkedIn profile URL and returns normalized JSON for the visible profile header, about text, experience, education, certifications, skills, languages, and profile/cover images. A same-origin browser test console is included at `/`.

The service uses a long-lived Playwright browser with an operator-provisioned LinkedIn session. It does **not** bypass login, MFA, checkpoints, CAPTCHA, challenges, access controls, or rate limits.

## URLs

- Test UI: http://localhost:3000/
- API information: http://localhost:3000/api
- Profile endpoint: http://localhost:3000/api/profile
- Health: http://localhost:3000/health

After deployment, replace `http://localhost:3000` with the public service origin. See [DEPLOYMENT.md](DEPLOYMENT.md) for the fastest Render deployment path and [API.md](API.md) for tester-facing endpoint documentation.

## Quick start

Requirements: Node.js 20+, pnpm 11+, and a LinkedIn account you are permitted to use.

~~~bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env
pnpm provision:session
pnpm dev
~~~

Set the generated local session path in .env:

~~~env
LINKEDIN_STORAGE_STATE_PATH=linkedin-storage-state.json
~~~

The production-style test console is served by the API at http://localhost:3000/. To work on the original Vinext UI separately, use:

~~~bash
pnpm dev:ui
~~~

Never commit the storage-state file. It contains private authenticated session material.

## API

### GET /health

~~~json
{
  "ok": true,
  "browser": "not_started",
  "linkedinSession": "configured"
}
~~~

Health reports readiness labels only; it never exposes cookies or session contents.

### POST /api/profile

Only these URL shapes are accepted:

~~~text
https://linkedin.com/in/<slug>
https://www.linkedin.com/in/<slug>
~~~

The service canonicalizes valid input to https://www.linkedin.com/in/<slug>/.

~~~bash
curl -X POST http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.linkedin.com/in/example/"}'
~~~

Example response:

~~~json
{
  "data": {
    "scrapedAt": "2026-08-31T00:00:00.000Z",
    "source": {
      "platform": "linkedin",
      "profileUrl": "https://www.linkedin.com/in/example/"
    },
    "profile": {
      "name": "Example Person",
      "pronouns": null,
      "headline": "Software Engineer",
      "location": "Bengaluru, Karnataka, India",
      "currentCompany": "Example Co",
      "followers": null,
      "connections": null,
      "images": {
        "profile": "https://...",
        "cover": "https://..."
      },
      "about": "...",
      "topSkills": []
    },
    "experience": [],
    "education": [],
    "certifications": [],
    "skills": [],
    "languages": []
  }
}
~~~

The internal regression diagnostics are removed unless INCLUDE_DEBUG=true.

## Architecture

~~~text
POST /api/profile
  -> 16 KB JSON parser
  -> strict LinkedIn profile URL validation
  -> per-IP rate limiter
  -> low-concurrency queue
  -> long-lived Playwright browser and authenticated context
  -> v11 hydration + deterministic DOM/section parser
  -> normalized JSON
~~~

The browser is owned by the service. Each request opens its own profile/detail pages and closes them in finally. The authenticated context is reused conservatively and the default extraction concurrency is one.

## Engineering approach

During reconnaissance I inspected LinkedIn's client/network behavior, but direct internal API access was not stable enough to use as the core of the solution. The implementation therefore treats LinkedIn's authenticated rendered client as the source of truth: it navigates the profile and detail routes, hydrates lazy-loaded sections, and parses their rendered semantic structure into normalized JSON.

The validated manual extractor is preserved verbatim at reference/linkedin-extractor-v11.cjs. The production extractor mechanically retains its helpers and parsing behavior while replacing the manual CDP entry point with a browser context supplied by the server.

Deterministic parsing was chosen over LLM extraction because it is reproducible, debuggable, inexpensive, and does not hallucinate profile values. Counts can be compared directly with the rendered LinkedIn UI.

## Authentication and session provisioning

pnpm provision:session opens a normal visible Playwright browser. Sign in manually, complete any MFA or verification yourself, navigate to a normal profile, return to the terminal, and press Enter. The script saves Playwright storageState locally.

Production-style configuration can load the same state from either:

~~~env
LINKEDIN_STORAGE_STATE_PATH=linkedin-storage-state.json
LINKEDIN_STORAGE_STATE_BASE64=
~~~

If both are set, the base64 value takes precedence. Values are never logged.

If LinkedIn redirects to login, auth wall, checkpoint, challenge, verification, or CAPTCHA, the request stops and returns:

~~~json
{
  "error": {
    "code": "upstream_authentication_required",
    "message": "The LinkedIn session requires authentication."
  }
}
~~~

## Configuration

See .env.example.

| Variable | Default | Purpose |
| --- | ---: | --- |
| PORT | 3000 | HTTP port |
| SCRAPE_CONCURRENCY | 1 | Maximum simultaneous extractions |
| SCRAPE_TIMEOUT_MS | 300000 | Overall request extraction timeout |
| RATE_LIMIT_WINDOW_MS | 60000 | Rate-limit window |
| RATE_LIMIT_MAX | 10 | Requests per window and client |
| INCLUDE_DEBUG | false | Include parser diagnostics |
| CORS_ORIGINS | local console origins | Comma-separated allowed origins |

## Error model

| Code | HTTP |
| --- | ---: |
| invalid_profile_url | 400 |
| upstream_profile_unavailable | 502 |
| upstream_authentication_required | 503 |
| upstream_timeout | 504 |
| scrape_failed | 502 |

Raw Playwright stacks, full profile JSON, cookies, passwords, storage state, and environment values are not logged or returned.

## Testing

~~~bash
pnpm test
~~~

Tests cover URL validation, API error mapping, relationship metadata in header parsing, single-date experience helpers, organization/employment metadata splitting, education fallback gating, context-aware skill filtering, and languages/proficiency pairing. They do not repeatedly hit LinkedIn.

The two known manual regression profiles should be checked sparingly after provisioning a session:

- Profile 1: education 5, certifications 8, skills 89, languages 0.
- Profile 2: organizations 10, roles 11, education 4, certifications 0, skills 75, languages 5.

Expected counts are diagnostics, never targets for truncation or fabrication.

## Docker

The Playwright package and container are both pinned to 1.55.0.

~~~bash
docker build -t tross-linkedin-profile-api .
docker run --rm -p 3000:3000 \
  -e LINKEDIN_STORAGE_STATE_BASE64="<private-base64-state>" \
  tross-linkedin-profile-api
~~~

Use your platform's secret manager for the base64 state. Do not bake it into the image or put it in shell history on shared machines.

## Deploy

This repository includes a `render.yaml` Blueprint and Dockerfile. The deployed service hosts both the UI and API from one HTTPS origin.

1. Push this repository to a private GitHub, GitLab, or Bitbucket repository.
2. Convert `linkedin-storage-state.json` to base64 without printing it:

~~~powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes((Resolve-Path "linkedin-storage-state.json"))
) | Set-Clipboard
~~~

3. In Render, choose **New > Blueprint**, select the repository, and apply `render.yaml`.
4. Paste the clipboard value into the secret `LINKEDIN_STORAGE_STATE_BASE64` when prompted.
5. When deployment finishes, open the service URL to use the UI or append `/api/profile` for the endpoint.

Never commit `.env` or the storage-state JSON. Full operational notes are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Known limitations

- An authenticated LinkedIn session is required and can expire.
- CAPTCHA, checkpoint, challenge, MFA, and verification pages are not bypassed.
- Visible data depends on the authenticated account's permissions.
- LinkedIn DOM/layout changes can require parser maintenance.
- Optional fields may be null or empty.
- Extraction is intentionally low-concurrency and may take several minutes.
- Hidden or non-rendered data is not available.
- Free hosting instances can cold-start and may not have enough memory for reliable Chromium workloads; increase the service plan if deployments or requests are killed for memory.

## Trade-offs

- A shared authenticated context reduces browser startup cost, but makes session health an operational dependency.
- Sequential detail-page extraction is slower, but respects the low-concurrency design and keeps v11 behavior stable.
- Rendering the actual client is more resource-intensive than an internal API, but it is testable against what the account can visibly access.
- No database is used; profile data exists only for the request lifecycle.

## Security checklist before publishing

Run git status, inspect the staged diff, and confirm that .env, storage state, browser profiles, captures, and generated profile JSON are absent. If session material ever enters Git history, remove it and rotate the LinkedIn session before sharing the repository.
