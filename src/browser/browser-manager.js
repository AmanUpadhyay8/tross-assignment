import { chromium } from "playwright";

import { loadStorageState } from "./auth.js";

const blockedResourceTypes = new Set(["font", "image", "media"]);

const launchArgs = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-gpu",
  "--disable-features=MediaRouter",
  "--mute-audio",
  "--no-first-run",
  "--no-zygote",
  "--renderer-process-limit=2",
];

async function createBrowserbaseSession(config) {
  const response = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bb-api-key": config.browserbaseApiKey,
    },
    body: JSON.stringify({
      timeout: 900,
      region: "ap-southeast-1",
      browserSettings: {
        viewport: { width: 1024, height: 640 },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Remote browser session creation failed (${response.status}).`);
  }

  const session = await response.json();
  if (!session?.connectUrl) {
    throw new Error("Remote browser session did not provide a connection URL.");
  }
  return session;
}

async function installStorageState(context, storageState) {
  if (storageState.cookies.length) {
    await context.addCookies(storageState.cookies);
  }

  const localStorageByOrigin = Object.fromEntries(
    storageState.origins.map(({ origin, localStorage = [] }) => [origin, localStorage]),
  );
  await context.addInitScript((entries) => {
    for (const { name, value } of entries[globalThis.location.origin] || []) {
      globalThis.localStorage.setItem(name, value);
    }
  }, localStorageByOrigin);
}

export class BrowserManager {
  constructor(config, launcher = chromium, remoteSessionFactory = createBrowserbaseSession) {
    this.config = config;
    this.launcher = launcher;
    this.remoteSessionFactory = remoteSessionFactory;
    this.browser = null;
    this.context = null;
    this.initializing = null;
  }

  getStatus() {
    return {
      browser: this.context ? "ready" : "not_started",
      browserMode: this.isRemote() ? "remote" : "local",
      linkedinSession:
        this.config.storageStateBase64 || this.config.storageStatePath
          ? "configured"
          : "not_configured",
    };
  }

  isRemote() {
    return Boolean(this.config.browserbaseApiKey);
  }

  async getContext() {
    if (this.context) return this.context;
    if (this.initializing) return this.initializing;

    this.initializing = this.#initialize();
    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async #initialize() {
    const storageState = await loadStorageState(this.config);
    if (this.isRemote()) {
      const session = await this.remoteSessionFactory(this.config);
      this.browser = await this.launcher.connectOverCDP(session.connectUrl);
      this.context = this.browser.contexts()[0];
      if (!this.context) throw new Error("Remote browser context is unavailable.");
      await Promise.allSettled(this.context.pages().map((page) => page.close()));
      await installStorageState(this.context, storageState);
    } else {
      this.browser = await this.launcher.launch({
        headless: true,
        args: launchArgs,
      });
      this.context = await this.browser.newContext({
        storageState,
        serviceWorkers: "block",
        viewport: { width: 1024, height: 640 },
      });
    }
    await this.context.route("**/*", (route) =>
      blockedResourceTypes.has(route.request().resourceType())
        ? route.abort()
        : route.continue(),
    );
    return this.context;
  }

  async close() {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }
}
