import { chromium } from "playwright";

import { loadStorageState } from "./auth.js";

export class BrowserManager {
  constructor(config, launcher = chromium) {
    this.config = config;
    this.launcher = launcher;
    this.browser = null;
    this.context = null;
    this.initializing = null;
  }

  getStatus() {
    return {
      browser: this.context ? "ready" : "not_started",
      linkedinSession:
        this.config.storageStateBase64 || this.config.storageStatePath
          ? "configured"
          : "not_configured",
    };
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
    this.browser = await this.launcher.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    this.context = await this.browser.newContext({ storageState });
    return this.context;
  }

  async close() {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }
}
