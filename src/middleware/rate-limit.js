import { rateLimit } from "express-rate-limit";

export function createRateLimiter(config) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "rate_limit_exceeded",
        message: "Too many requests. Please try again later.",
      },
    },
  });
}
