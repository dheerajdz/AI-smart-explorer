import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Sanitize error details to prevent sensitive data leakage in logs.
 * Removes potential secrets, tokens, and PII from error messages.
 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CARD]')
    .replace(/password[=:]\S+/gi, 'password=[REDACTED]')
    .replace(/secret[=:]\S+/gi, 'secret=[REDACTED]')
    .replace(/token[=:]\S+/gi, 'token=[REDACTED]')
    .replace(/mongodb\+srv:\/\/[^\s]+/gi, '[REDACTED_MONGO_URI]');
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDev = env.NODE_ENV === 'development';
  const safeMessage = sanitizeErrorMessage(err.message);

  // Log sanitized error; include stack only in development
  logger.error('Unhandled error', {
    error: safeMessage,
    ...(isDev && { stack: err.stack }),
  });

  // Send generic response in production; detailed in development
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(isDev && { detail: safeMessage, stack: err.stack }),
  });
}
