import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import cors from "cors";
import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { createProfileRouter } from "./routes/profile.js";

export function createApp({ config, service, browserManager }) {
  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    req.id = req.get("x-request-id")?.slice(0, 128) || randomUUID();
    res.set("x-request-id", req.id);
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ["GET", "POST"],
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(
    express.static(resolve("public"), {
      extensions: ["html"],
      index: "index.html",
      maxAge: config.nodeEnv === "production" ? "1h" : 0,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ...browserManager.getStatus() });
  });

  app.get("/api", (_req, res) => {
    res.json({
      name: "Tross LinkedIn Profile API",
      version: "v11",
      endpoints: {
        health: { method: "GET", path: "/health" },
        profile: { method: "POST", path: "/api/profile" },
      },
      documentation: "/#api-docs",
    });
  });

  app.use("/api/profile", createRateLimiter(config), createProfileRouter(service));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
