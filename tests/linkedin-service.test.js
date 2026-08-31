import assert from "node:assert/strict";
import test from "node:test";

import { LinkedInService } from "../src/scraper/linkedin-service.js";

test("browser startup failures use the public scrape_failed error model", async () => {
  const browserManager = {
    async getContext() {
      throw new Error("browser launch failed");
    },
  };

  const service = new LinkedInService({
    browserManager,
    config: {
      scrapeConcurrency: 1,
      scrapeTimeoutMs: 100,
      includeDebug: false,
    },
  });

  await assert.rejects(service.scrape("https://www.linkedin.com/in/test/"), {
    code: "scrape_failed",
    status: 502,
    message: "LinkedIn profile extraction failed.",
  });
});
