import assert from "node:assert/strict";
import test from "node:test";

import { validateLinkedInProfileUrl } from "../src/utils/linkedin-url.js";

test("accepts and canonicalizes LinkedIn profile URLs", () => {
  assert.equal(
    validateLinkedInProfileUrl("https://linkedin.com/in/example-slug"),
    "https://www.linkedin.com/in/example-slug/",
  );
  assert.equal(
    validateLinkedInProfileUrl("https://www.linkedin.com/in/Example_123/"),
    "https://www.linkedin.com/in/Example_123/",
  );
});

test("rejects non-profile, deceptive, or non-HTTPS URLs", () => {
  const invalid = [
    "http://www.linkedin.com/in/example/",
    "https://evil-linkedin.com/in/example/",
    "https://linkedin.com.evil.example/in/example/",
    "https://www.linkedin.com/company/openai/",
    "https://www.linkedin.com/jobs/123/",
    "https://www.linkedin.com/in/example/details/skills/",
    "https://www.linkedin.com/in/example/?trk=test",
    "not a url",
    null,
  ];

  for (const value of invalid) assert.equal(validateLinkedInProfileUrl(value), null);
});
