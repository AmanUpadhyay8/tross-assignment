import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createConfig } from "../src/config.js";
import { UpstreamAuthenticationRequiredError } from "../src/scraper/errors.js";

async function withServer(service, run) {
  const config = createConfig({
    RATE_LIMIT_MAX: "100",
    RATE_LIMIT_WINDOW_MS: "60000",
  });
  const browserManager = {
    getStatus: () => ({ browser: "not_started", linkedinSession: "not_configured" }),
  };
  const app = createApp({ config, service, browserManager });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("health does not expose session contents", async () => {
  await withServer({ scrape() {} }, async (origin) => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      deployment: "local",
      browser: "not_started",
      linkedinSession: "not_configured",
    });
  });
});

test("serves the public test console and API manifest", async () => {
  await withServer({ scrape() {} }, async (origin) => {
    const consoleResponse = await fetch(`${origin}/`);
    assert.equal(consoleResponse.status, 200);
    assert.match(await consoleResponse.text(), /Tross Profile API/);

    const manifestResponse = await fetch(`${origin}/api`);
    assert.equal(manifestResponse.status, 200);
    assert.deepEqual((await manifestResponse.json()).endpoints, {
      health: { method: "GET", path: "/health" },
      profile: { method: "POST", path: "/api/profile" },
    });
  });
});

test("profile route validates and canonicalizes input", async () => {
  const service = {
    async scrape(profileUrl) {
      return { source: { platform: "linkedin", profileUrl }, profile: { name: "Test" } };
    },
  };

  await withServer(service, async (origin) => {
    const invalid = await fetch(`${origin}/api/profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/in/test" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "invalid_profile_url");

    const valid = await fetch(`${origin}/api/profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://linkedin.com/in/test" }),
    });
    assert.equal(valid.status, 200);
    assert.equal(
      (await valid.json()).data.source.profileUrl,
      "https://www.linkedin.com/in/test/",
    );
  });
});

test("authentication challenges fail safely with 503", async () => {
  const service = {
    async scrape() {
      throw new UpstreamAuthenticationRequiredError();
    },
  };

  await withServer(service, async (origin) => {
    const response = await fetch(`${origin}/api/profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.linkedin.com/in/test/" }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "upstream_authentication_required",
        message: "The LinkedIn session requires authentication.",
      },
    });
  });
});
