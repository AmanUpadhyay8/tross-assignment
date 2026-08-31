import { Router } from "express";

import { InvalidProfileUrlError } from "../scraper/errors.js";
import { validateLinkedInProfileUrl } from "../utils/linkedin-url.js";

export function createProfileRouter(service) {
  const router = Router();

  router.post("/", async (req, res, next) => {
    const profileUrl = validateLinkedInProfileUrl(req.body?.url);
    if (!profileUrl) return next(new InvalidProfileUrlError());

    const startedAt = Date.now();
    console.info(`requestId=${req.id} scrape_started slug=${new URL(profileUrl).pathname}`);

    try {
      const data = await service.scrape(profileUrl);
      console.info(
        `requestId=${req.id} scrape_completed durationMs=${Date.now() - startedAt}`,
      );
      return res.json({ data });
    } catch (error) {
      console.warn(
        `requestId=${req.id} scrape_failed code=${error?.code || "unknown"} durationMs=${Date.now() - startedAt}`,
      );
      return next(error);
    }
  });

  return router;
}
