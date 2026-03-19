import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow health check without auth
  if (req.path === '/api/health') return next();

  // Skip auth if no token is configured (backwards compatible)
  if (!config.authToken) return next();

  const token = req.headers['x-mc-token'] as string
    || req.headers['authorization']?.replace('Bearer ', '')
    || (req.query.token as string);

  if (!token || token !== config.authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
