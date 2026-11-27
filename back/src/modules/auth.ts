import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User, VendorProfile } from '../models';
import { asyncHandler } from '../common/async';
import { AppError } from '../common/errors';
import { AuthRequest, authenticate } from '../common/auth';
import { env } from '../config/env';

export const authRouter = Router();
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
const cookieOptions = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAME_SITE, path: '/api/v1/auth' as const };
function issueAccess(user: { _id: unknown; role: string }): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, { subject: String(user._id), expiresIn: env.ACCESS_TOKEN_TTL as NonNullable<jwt.SignOptions['expiresIn']> });
}
async function issueRefresh(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex');
  await User.updateOne({ _id: userId }, { refreshTokenHash: crypto.createHash('sha256').update(token).digest('hex'), refreshTokenExpiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000) });
  return token;
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const input = credentials.strict().parse(req.body);
  const user = await User.create({ email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12), role: 'customer' });
  res.status(201).json({ data: { id: String(user._id), email: user.email, role: user.role } });
}));
authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = credentials.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)) || user.status !== 'active') throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const refresh = await issueRefresh(String(user._id));
  res.cookie('refreshToken', refresh, cookieOptions).json({ data: { accessToken: issueAccess(user), user: { id: String(user._id), email: user.email, role: user.role } } });
}));
authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ refreshTokenHash: hash, refreshTokenExpiresAt: { $gt: new Date() }, status: 'active' }).select('+refreshTokenHash');
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  const refresh = await issueRefresh(String(user._id));
  res.cookie('refreshToken', refresh, cookieOptions).json({ data: { accessToken: issueAccess(user) } });
}));
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (token) await User.updateOne({ refreshTokenHash: crypto.createHash('sha256').update(token).digest('hex') }, { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } });
  res.clearCookie('refreshToken', cookieOptions).status(204).end();
}));
authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { userId } = (req as AuthRequest).auth!;
  const user = await User.findById(userId).select('email role status');
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  res.json({ data: { id: String(user._id), email: user.email, role: user.role, status: user.status } });
}));
