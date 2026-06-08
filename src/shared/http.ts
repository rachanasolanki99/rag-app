import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { AppError, UnauthorizedError } from './errors';
import type { Logger } from './logger';

/** Wraps async route handlers so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Simple API-key auth. Clients must send `x-api-key`. */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const provided = req.header('x-api-key');
  if (!provided || provided !== config.API_KEY) {
    throw new UnauthorizedError('Missing or invalid API key');
  }
  next();
}

/** Centralized error handler -> consistent JSON error envelope. */
export function errorHandler(logger: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, details: err.details });
      return;
    }
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  };
}
