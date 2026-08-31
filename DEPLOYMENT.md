# Deploy the Tross API and UI

The fastest supported setup is one Docker web service on Render. It exposes the test UI and the API from one public HTTPS origin, so no separate frontend deployment or CORS setup is needed.

## 1. Put the code in a private Git repository

Do not commit `.env`, `linkedin-storage-state.json`, or any browser profile. They are already covered by `.gitignore`.

~~~powershell
git init
git add .
git commit -m "Deploy Tross LinkedIn profile API"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_PRIVATE_REPOSITORY.git
git push -u origin main
~~~

Create the private repository in GitHub, GitLab, or Bitbucket before adding its remote URL.

## 2. Copy the LinkedIn session as a secret

Run this locally. It copies the base64 value to the Windows clipboard without displaying it in the terminal:

~~~powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes((Resolve-Path "linkedin-storage-state.json"))
) | Set-Clipboard
~~~

If your `.env` uses a different `LINKEDIN_STORAGE_STATE_PATH`, substitute that file path. Treat the clipboard value like a password.

## 3. Create the Render service

1. Open the Render Dashboard.
2. Choose **New > Blueprint**.
3. Connect the private repository.
4. Render will detect `render.yaml`; approve the Blueprint.
5. When prompted for `LINKEDIN_STORAGE_STATE_BASE64`, paste the clipboard value.
6. Create the service and wait for `/health` to become healthy.

The Blueprint starts on Render's free plan so deployment does not silently create a paid resource. Playwright Chromium is memory-heavy: for a reliable deadline/demo service, change the plan in the Render dashboard to a paid instance with at least 2 GB of RAM if the free instance is killed, restarts, or times out.

## 4. Give testers these URLs

For a service origin such as `https://tross-linkedin-profile-api.onrender.com`:

- UI: `https://tross-linkedin-profile-api.onrender.com/`
- Health: `https://tross-linkedin-profile-api.onrender.com/health`
- API information: `https://tross-linkedin-profile-api.onrender.com/api`
- Endpoint: `POST https://tross-linkedin-profile-api.onrender.com/api/profile`

PowerShell test:

~~~powershell
$body = @{ url = "https://www.linkedin.com/in/example/" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR-SERVICE.onrender.com/api/profile" `
  -ContentType "application/json" `
  -Body $body
~~~

curl test:

~~~bash
curl -X POST "https://YOUR-SERVICE.onrender.com/api/profile" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.linkedin.com/in/example/"}'
~~~

The first request after a free-instance idle period can be slow. Extraction itself can take two to five minutes; clients should allow at least a five-minute timeout.

## Session renewal

If the endpoint returns `upstream_authentication_required`:

1. Run `pnpm provision:session` locally and complete LinkedIn login/MFA yourself.
2. Create a new base64 clipboard value using the command above.
3. Replace `LINKEDIN_STORAGE_STATE_BASE64` in the Render service environment.
4. save the environment change and redeploy/restart the service.

The application does not bypass login, MFA, checkpoints, CAPTCHA, challenges, access controls, or LinkedIn rate limits.

## Troubleshooting

- **Build fails:** confirm Render selected the Docker runtime and the repository contains `Dockerfile`, `pnpm-lock.yaml`, and `public/index.html`.
- **Browser exits or service restarts:** the instance likely needs more memory.
- **503 authentication error:** renew the storage-state secret.
- **504 timeout:** retry once, then inspect Render logs for navigation or memory failures.
- **429 response:** wait for the one-minute rate-limit window. The default is ten requests per client per minute and one active scrape at a time.
