import pLimit from "p-limit";

import { assertLinkedInSession } from "../browser/auth.js";
import {
  AppError,
  ScrapeFailedError,
  UpstreamTimeoutError,
} from "./errors.js";
import { extractLinkedInProfile } from "./linkedin-extractor.js";

export class LinkedInService {
  constructor({ browserManager, config, extractor = extractLinkedInProfile }) {
    this.browserManager = browserManager;
    this.config = config;
    this.extractor = extractor;
    this.limit = pLimit(config.scrapeConcurrency);
  }

  scrape(profileUrl) {
    return this.limit(() => this.#scrape(profileUrl));
  }

  async #scrape(profileUrl) {
    let context;
    try {
      context = await this.browserManager.getContext();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new ScrapeFailedError({ cause: error });
    }

    const existingPages = new Set(context.pages());
    let timeout;
    let timedOut = false;

    const work = this.extractor({
      context,
      profileUrl,
      includeDebug: this.config.includeDebug,
      assertSession: assertLinkedInSession,
    });

    try {
      return await Promise.race([
        work,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => {
              timedOut = true;
              reject(new UpstreamTimeoutError());
            },
            this.config.scrapeTimeoutMs,
          );
          timeout.unref?.();
        }),
      ]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new ScrapeFailedError({ cause: error });
    } finally {
      clearTimeout(timeout);
      if (timedOut) {
        await Promise.allSettled(
          context
            .pages()
            .filter((page) => !existingPages.has(page))
            .map((page) => page.close()),
        );
      }
      if (this.browserManager.isRemote?.()) {
        await this.browserManager.close();
      }
    }
  }
}
