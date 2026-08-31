import "dotenv/config";

import { createApp } from "./app.js";
import { BrowserManager } from "./browser/browser-manager.js";
import { config } from "./config.js";
import { LinkedInService } from "./scraper/linkedin-service.js";

const browserManager = new BrowserManager(config);
const service = new LinkedInService({ browserManager, config });
const app = createApp({ config, service, browserManager });

const server = app.listen(config.port, () => {
  console.info(`Tross LinkedIn Profile API listening on http://localhost:${config.port}`);
});

// Render recommends keeping Node connections alive longer than its edge proxy.
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;

async function shutdown(signal) {
  console.info(`${signal} received; shutting down.`);
  server.close(async () => {
    await browserManager.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
