import assert from "node:assert/strict";
import test from "node:test";

import { BrowserManager } from "../src/browser/browser-manager.js";

test("browser manager uses low-memory production settings", async () => {
  let launchOptions;
  let contextOptions;
  let routePattern;
  let routeHandler;

  const context = {
    async route(pattern, handler) {
      routePattern = pattern;
      routeHandler = handler;
    },
  };
  const launcher = {
    async launch(options) {
      launchOptions = options;
      return {
        async newContext(options) {
          contextOptions = options;
          return context;
        },
      };
    },
  };
  const storageState = { cookies: [], origins: [] };
  const manager = new BrowserManager(
    {
      storageStateBase64: Buffer.from(JSON.stringify(storageState)).toString("base64"),
      storageStatePath: "",
    },
    launcher,
  );

  assert.equal(await manager.getContext(), context);
  assert.equal(launchOptions.headless, true);
  assert.ok(launchOptions.args.includes("--renderer-process-limit=2"));
  assert.equal(contextOptions.serviceWorkers, "block");
  assert.deepEqual(contextOptions.viewport, { width: 1024, height: 640 });
  assert.deepEqual(contextOptions.storageState, storageState);
  assert.equal(routePattern, "**/*");

  let action;
  await routeHandler({
    request: () => ({ resourceType: () => "image" }),
    abort: async () => {
      action = "abort";
    },
    continue: async () => {
      action = "continue";
    },
  });
  assert.equal(action, "abort");

  await routeHandler({
    request: () => ({ resourceType: () => "script" }),
    abort: async () => {
      action = "abort";
    },
    continue: async () => {
      action = "continue";
    },
  });
  assert.equal(action, "continue");
});

test("browser manager can offload Chromium to a remote session", async () => {
  const actions = [];
  let initEntries;
  const initialPage = { close: async () => actions.push("close-initial-page") };
  const context = {
    pages: () => [initialPage],
    async addCookies(cookies) {
      actions.push(["cookies", cookies.length]);
    },
    async addInitScript(_script, entries) {
      initEntries = entries;
    },
    async route() {
      actions.push("route");
    },
    async close() {
      actions.push("close-context");
    },
  };
  const browser = {
    contexts: () => [context],
    async close() {
      actions.push("close-browser");
    },
  };
  const launcher = {
    async connectOverCDP(url) {
      assert.equal(url, "wss://browser.example/session");
      return browser;
    },
  };
  const storageState = {
    cookies: [{ name: "session", value: "private", domain: ".linkedin.com", path: "/" }],
    origins: [{ origin: "https://www.linkedin.com", localStorage: [{ name: "x", value: "y" }] }],
  };
  const manager = new BrowserManager(
    {
      browserbaseApiKey: "test-key",
      storageStateBase64: Buffer.from(JSON.stringify(storageState)).toString("base64"),
      storageStatePath: "",
    },
    launcher,
    async () => ({ connectUrl: "wss://browser.example/session" }),
  );

  assert.equal(manager.isRemote(), true);
  assert.equal(manager.getStatus().browserMode, "remote");
  assert.equal(await manager.getContext(), context);
  assert.deepEqual(actions.slice(0, 3), ["close-initial-page", ["cookies", 1], "route"]);
  assert.deepEqual(initEntries, {
    "https://www.linkedin.com": [{ name: "x", value: "y" }],
  });
  await manager.close();
  assert.ok(actions.includes("close-browser"));
});
