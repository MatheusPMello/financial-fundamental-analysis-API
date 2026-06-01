/**
 * Base Application Error class for custom semantic errors.
 * Express errorHandler middleware catches this class to return appropriate HTTP status codes.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when a resource (e.g. Stock ticker) cannot be found.
 * Maps to HTTP 404 Not Found.
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

/**
 * Thrown when the request is syntactically valid, but data cannot be processed
 * due to missing fields or business validation failure.
 * Maps to HTTP 422 Unprocessable Entity.
 */
export class InsufficientDataError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}
