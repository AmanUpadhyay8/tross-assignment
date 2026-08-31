import { AppError } from "../scraper/errors.js";

export function notFoundHandler(_req, res) {
  res.status(404).json({
    error: { code: "not_found", message: "Route not found." },
  });
}

export function errorHandler(error, _req, res, _next) {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: { code: "payload_too_large", message: "The JSON body is too large." },
    });
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      error: { code: "invalid_json", message: "A valid JSON body is required." },
    });
  }

  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "internal_error";
  const message =
    error instanceof AppError ? error.message : "An unexpected error occurred.";

  return res.status(status).json({ error: { code, message } });
}
