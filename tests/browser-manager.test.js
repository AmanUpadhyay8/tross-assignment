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
