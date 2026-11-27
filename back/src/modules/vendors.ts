import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../common/async';
import { AuthRequest, authenticate, requireRole } from '../common/auth';
import { AppError } from '../common/errors';
import { Store, User, VendorProfile } from '../models';

export const vendorRouter = Router();
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

vendorRouter.post('/register', asyncHandler(async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(8).max(128), businessName: z.string().min(2).max(120) }).parse(req.body);
  const user = await User.create({ email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12), role: 'vendor' });
  const vendor = await VendorProfile.create({ userId: user._id, businessName: input.businessName, status: 'pending' });
  res.status(201).json({ data: { vendorId: String(vendor._id), status: vendor.status } });
}));

vendorRouter.get('/me', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ userId: (req as AuthRequest).auth!.userId });
  if (!vendor) throw new AppError(404, 'NOT_FOUND', 'Vendor profile not found');
  res.json({ data: vendor });
}));

vendorRouter.patch('/me', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const input = z.object({ businessName: z.string().min(2).max(120) }).strict().parse(req.body);
  const vendor = await VendorProfile.findOneAndUpdate({ userId: (req as AuthRequest).auth!.userId }, { businessName: input.businessName }, { new: true, runValidators: true });
  if (!vendor) throw new AppError(404, 'NOT_FOUND', 'Vendor profile not found');
  res.json({ data: vendor });
}));

vendorRouter.put('/me/store', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const input = z.object({ name: z.string().min(2).max(100), description: z.string().max(2000).default('') }).strict().parse(req.body);
  const vendor = await VendorProfile.findOne({ userId: (req as AuthRequest).auth!.userId, status: 'approved' });
  if (!vendor) throw new AppError(403, 'VENDOR_NOT_APPROVED', 'Approved vendor status is required');
  const slug = slugify(input.name);
  if (!slug) throw new AppError(400, 'INVALID_STORE_NAME', 'Store name must contain letters or numbers');
  const store = await Store.findOneAndUpdate({ vendorId: vendor._id }, { $set: { name: input.name, slug, description: input.description, active: true } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  res.json({ data: store });
}));

export const adminVendorRouter = Router();
adminVendorRouter.get('/', authenticate, requireRole('admin'), asyncHandler(async (_req, res) => {
  res.json({ data: await VendorProfile.find().sort({ createdAt: -1 }).limit(100) });
}));
adminVendorRouter.patch('/:vendorId/status', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['approved', 'rejected', 'suspended']) }).strict().parse(req.body);
  const vendor = await VendorProfile.findByIdAndUpdate(req.params.vendorId, { status }, { new: true, runValidators: true });
  if (!vendor) throw new AppError(404, 'NOT_FOUND', 'Vendor not found');
  res.json({ data: vendor });
}));
