import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  UpstreamAuthenticationRequiredError,
  UpstreamProfileUnavailableError,
} from "../scraper/errors.js";

function parseStorageState(serialized) {
  let state;
  try {
    state = JSON.parse(serialized);
  } catch {
    throw new UpstreamAuthenticationRequiredError();
  }

  if (!state || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) {
    throw new UpstreamAuthenticationRequiredError();
  }
  return state;
}

export async function loadStorageState(config) {
  if (config.storageStateBase64) {
    const serialized = Buffer.from(config.storageStateBase64, "base64").toString("utf8");
    return parseStorageState(serialized);
  }

  if (config.storageStatePath) {
    try {
      const serialized = await readFile(resolve(config.storageStatePath), "utf8");
      return parseStorageState(serialized);
    } catch (error) {
      if (error instanceof UpstreamAuthenticationRequiredError) throw error;
      throw new UpstreamAuthenticationRequiredError();
    }
  }

  throw new UpstreamAuthenticationRequiredError();
}

const authPath = /\/(login|uas\/login|authwall|checkpoint|challenge|verify)(\/|$)/i;

export async function assertLinkedInSession(page, expectedUrl) {
  let current;
  try {
    current = new URL(page.url());
  } catch {
    throw new UpstreamProfileUnavailableError();
  }

  if (current.hostname !== "www.linkedin.com" && current.hostname !== "linkedin.com") {
    throw new UpstreamAuthenticationRequiredError();
  }

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 3_000 })
    .catch(() => "");

  const hasChallenge = await page
    .locator('iframe[src*="captcha" i], [data-test-id*="captcha" i], input[name="session_key"]')
    .count()
    .then((count) => count > 0)
    .catch(() => false);

  if (
    authPath.test(current.pathname) ||
    hasChallenge ||
    /security verification|let.?s do a quick security check|sign in to linkedin|join linkedin/i.test(
      bodyText.slice(0, 12_000),
    )
  ) {
    throw new UpstreamAuthenticationRequiredError();
  }

  if (expectedUrl) {
    const expected = new URL(expectedUrl);
    if (
      expected.pathname.includes("/in/") &&
      !current.pathname.startsWith(expected.pathname.replace(/\/$/, ""))
    ) {
      throw new UpstreamProfileUnavailableError();
    }
  }
}
