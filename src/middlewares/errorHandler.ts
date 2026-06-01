import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';

/**
 * Global Express Error Handling Middleware.
 * Intercepts all errors thrown in routes/controllers and formats the HTTP response.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // If it is a known custom application error, respond with its status code
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Otherwise, log the error trace and respond with a 500 Internal Server Error
  // eslint-disable-next-line no-console
  console.error('[Unhandled Internal Error]:', err);
  res.status(500).json({ error: 'Internal Server Error' });
};
