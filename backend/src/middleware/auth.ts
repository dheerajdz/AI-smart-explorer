import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
  };
}

/**
 * JWT Authentication Middleware
 * Verifies Bearer token and attaches user to request
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: No token provided',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Use JWT_SECRET from env, fallback to a default only for dev (should be set in production)
    const secret = env.JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      logger.error('[auth] JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Server error: Authentication not configured',
      });
      return;
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
      role?: string;
    };

    req.user = decoded;
    next();
  } catch (err: any) {
    logger.warn('[auth] Invalid token', { error: err.message, ip: req.ip });
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
  }
}

/**
 * Optional Auth Middleware
 * Attaches user if token exists, but doesn't require it
 */
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = env.JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return next();
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
      role?: string;
    };

    req.user = decoded;
  } catch {
    // Invalid token, but optional — continue without user
  }

  next();
}

/**
 * Admin Role Middleware
 * Requires authMiddleware first, then checks admin role
 */
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Authentication required',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    logger.warn('[auth] Admin access denied', { userId: req.user.userId, ip: req.ip });
    res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required',
    });
    return;
  }

  next();
}
