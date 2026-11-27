import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errors';

export type Role = 'customer' | 'vendor' | 'admin';
export interface AuthRequest extends Request { auth?: { userId: string; role: Role } }

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string' || !['customer', 'vendor', 'admin'].includes(String(payload.role))) throw new Error('Invalid claims');
    req.auth = { userId: payload.sub, role: payload.role as Role };
    next();
  } catch { next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required')); }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    next();
  };
}
