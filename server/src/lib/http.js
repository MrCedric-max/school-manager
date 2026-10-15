/** An error carrying an HTTP status code and a user-facing message. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);

/** Express error handler: JSON for API errors, never leaks stack traces. */
export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  res.status(status).json({
    error: status >= 500 ? 'Unexpected server error' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
