# Tross Profile API

## Endpoint

`POST /api/profile`

Request headers:

~~~http
Content-Type: application/json
~~~

Request body:

~~~json
{
  "url": "https://www.linkedin.com/in/example/"
}
~~~

Accepted URLs are public LinkedIn profile paths in either of these forms:

~~~text
https://linkedin.com/in/<slug>
https://www.linkedin.com/in/<slug>
~~~

## Test from PowerShell

~~~powershell
$body = @{ url = "https://www.linkedin.com/in/example/" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR-SERVICE.onrender.com/api/profile" `
  -ContentType "application/json" `
  -Body $body
~~~

## Test with curl

~~~bash
curl -X POST "https://YOUR-SERVICE.onrender.com/api/profile" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.linkedin.com/in/example/"}'
~~~

Successful responses use this envelope:

~~~json
{
  "data": {
    "scrapedAt": "2026-08-31T00:00:00.000Z",
    "source": {
      "platform": "linkedin",
      "profileUrl": "https://www.linkedin.com/in/example/"
    },
    "profile": {},
    "experience": [],
    "education": [],
    "certifications": [],
    "skills": [],
    "languages": []
  }
}
~~~

## Status and error responses

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `invalid_profile_url` | The body or LinkedIn profile URL is invalid. |
| 429 | standard rate-limit response | Too many requests from the same client. |
| 502 | `upstream_profile_unavailable` | The profile is unavailable to the authenticated account. |
| 502 | `scrape_failed` | Extraction failed unexpectedly. |
| 503 | `upstream_authentication_required` | The server's LinkedIn session needs renewal. |
| 504 | `upstream_timeout` | LinkedIn navigation or extraction timed out. |

Errors use this envelope:

~~~json
{
  "error": {
    "code": "invalid_profile_url",
    "message": "A valid LinkedIn profile URL is required."
  }
}
~~~

The endpoint is intentionally low-concurrency. A request can take two to five minutes, so clients should use a timeout of at least five minutes. The server returns only data visible to its configured LinkedIn session.
