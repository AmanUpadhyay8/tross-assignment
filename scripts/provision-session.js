import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "playwright";

import { assertLinkedInSession } from "../src/browser/auth.js";

const outputPath = process.env.LINKEDIN_STORAGE_STATE_PATH || "linkedin-storage-state.json";
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
const prompt = createInterface({ input, output });

try {
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
  output.write(
    "Sign in normally in the Playwright window. Complete any verification manually, then return here.\n",
  );
  await prompt.question("Press Enter after a LinkedIn profile page is visible: ");
  await assertLinkedInSession(page);
  await context.storageState({ path: outputPath });
  output.write(`Session saved locally to ${outputPath}. Keep this file private.\n`);
} finally {
  prompt.close();
  await browser.close();
}
