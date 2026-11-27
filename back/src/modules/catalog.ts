import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../common/async';
import { AuthRequest, authenticate, requireRole } from '../common/auth';
import { AppError } from '../common/errors';
import { Category, Product, Store, VendorProfile } from '../models';

export const catalogRouter = Router();
const productInput = z.object({ name: z.string().min(1).max(160), description: z.string().max(5000).default(''), categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/), pricePaise: z.number().int().positive(), stock: z.number().int().nonnegative() }).strict();
async function ownedStore(userId: string) {
  const vendor = await VendorProfile.findOne({ userId, status: 'approved' });
  if (!vendor) throw new AppError(403, 'VENDOR_NOT_APPROVED', 'Approved vendor status is required');
  const store = await Store.findOne({ vendorId: vendor._id, active: true });
  if (!store) throw new AppError(409, 'STORE_REQUIRED', 'Create an active store first');
  return { vendor, store };
}
catalogRouter.get('/products', asyncHandler(async (req, res) => {
  const query = z.object({ q: z.string().max(100).optional(), category: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest') }).parse(req.query);
  const filter: Record<string, unknown> = { status: 'published' };
  if (query.category) filter.categoryId = query.category;
  if (query.q) filter.name = { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const finder = Product.find(filter);
  if (query.sort === 'price_asc') finder.sort({ pricePaise: 1 });
  else if (query.sort === 'price_desc') finder.sort({ pricePaise: -1 });
  else finder.sort({ createdAt: -1 });
  const [items, total] = await Promise.all([finder.skip((query.page - 1) * query.limit).limit(query.limit).lean(), Product.countDocuments(filter)]);
  res.json({ data: items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));
catalogRouter.get('/products/:productId', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.productId, status: 'published' }).lean();
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.json({ data: product });
}));
catalogRouter.get('/categories', asyncHandler(async (_req, res) => res.json({ data: await Category.find({ active: true }).sort({ name: 1 }).lean() })));
catalogRouter.get('/stores/:storeSlug', asyncHandler(async (req, res) => {
  const store = await Store.findOne({ slug: req.params.storeSlug, active: true }).lean();
  if (!store) throw new AppError(404, 'NOT_FOUND', 'Store not found');
  const products = await Product.find({ storeId: store._id, status: 'published' }).limit(100).lean();
  res.json({ data: { store, products } });
}));

catalogRouter.get('/vendors/me/products', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const { vendor } = await ownedStore((req as AuthRequest).auth!.userId);
  res.json({ data: await Product.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).lean() });
}));
catalogRouter.post('/vendors/me/products', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const input = productInput.parse(req.body);
  const { vendor, store } = await ownedStore((req as AuthRequest).auth!.userId);
  if (!(await Category.exists({ _id: input.categoryId, active: true }))) throw new AppError(400, 'INVALID_CATEGORY', 'Category is not available');
  const product = await Product.create({ ...input, vendorId: vendor._id, storeId: store._id, status: 'pending' });
  res.status(201).json({ data: product });
}));
catalogRouter.patch('/vendors/me/products/:productId', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const input = productInput.partial().strict().parse(req.body);
  const { vendor } = await ownedStore((req as AuthRequest).auth!.userId);
  const product = await Product.findOneAndUpdate({ _id: req.params.productId, vendorId: vendor._id }, { ...input, status: 'pending' }, { new: true, runValidators: true });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.json({ data: product });
}));
catalogRouter.delete('/vendors/me/products/:productId', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const { vendor } = await ownedStore((req as AuthRequest).auth!.userId);
  const product = await Product.findOneAndUpdate({ _id: req.params.productId, vendorId: vendor._id }, { status: 'draft' }, { new: true });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.json({ data: { id: String(product._id), status: product.status } });
}));

export const adminCatalogRouter = Router();
adminCatalogRouter.post('/categories', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const input = z.object({ name: z.string().min(1).max(100), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }).strict().parse(req.body);
  res.status(201).json({ data: await Category.create(input) });
}));
adminCatalogRouter.get('/products', authenticate, requireRole('admin'), asyncHandler(async (_req, res) => res.json({ data: await Product.find().sort({ createdAt: -1 }).limit(100).lean() })));
adminCatalogRouter.patch('/products/:productId/moderation', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['published', 'rejected']) }).strict().parse(req.body);
  const product = await Product.findByIdAndUpdate(req.params.productId, { status }, { new: true, runValidators: true });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.json({ data: product });
}));
