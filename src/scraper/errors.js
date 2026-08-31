export class AppError extends Error {
  constructor(code, message, status, options = {}) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

export class InvalidProfileUrlError extends AppError {
  constructor() {
    super(
      "invalid_profile_url",
      "A valid LinkedIn profile URL is required.",
      400,
    );
  }
}

export class UpstreamProfileUnavailableError extends AppError {
  constructor() {
    super(
      "upstream_profile_unavailable",
      "The LinkedIn profile is unavailable.",
      502,
    );
  }
}

export class UpstreamAuthenticationRequiredError extends AppError {
  constructor() {
    super(
      "upstream_authentication_required",
      "The LinkedIn session requires authentication.",
      503,
    );
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor() {
    super(
      "upstream_timeout",
      "LinkedIn profile extraction timed out.",
      504,
    );
  }
}

export class ScrapeFailedError extends AppError {
  constructor(options = {}) {
    super(
      "scrape_failed",
      "LinkedIn profile extraction failed.",
      502,
      options,
    );
  }
}
