function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

export function createConfig(env = process.env) {
  const defaultCorsOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    env.RENDER_EXTERNAL_URL,
  ].filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV || "development",
    deployment: env.RENDER_GIT_COMMIT?.slice(0, 7) || "local",
    port: positiveInteger(env.PORT, 3000),
    scrapeConcurrency: positiveInteger(env.SCRAPE_CONCURRENCY, 1),
    scrapeTimeoutMs: positiveInteger(env.SCRAPE_TIMEOUT_MS, 300_000),
    rateLimitWindowMs: positiveInteger(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: positiveInteger(env.RATE_LIMIT_MAX, 10),
    includeDebug: boolean(env.INCLUDE_DEBUG),
    storageStatePath: env.LINKEDIN_STORAGE_STATE_PATH || "",
    storageStateBase64: env.LINKEDIN_STORAGE_STATE_BASE64 || "",
    browserbaseApiKey: env.BROWSERBASE_API_KEY || "",
    corsOrigins: (env.CORS_ORIGINS || defaultCorsOrigins.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export const config = createConfig();
