import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../common/async';
import { AuthRequest, authenticate, requireRole } from '../common/auth';
import { AppError } from '../common/errors';
import { Cart, Order, Payment, Product } from '../models';

export const cartRouter = Router();
cartRouter.get('/', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ customerId: (req as AuthRequest).auth!.userId }).populate('items.productId', 'name pricePaise status stock');
  res.json({ data: cart ?? { items: [] } });
}));
cartRouter.put('/', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const { items } = z.object({ items: z.array(z.object({ productId: z.string().regex(/^[0-9a-fA-F]{24}$/), quantity: z.number().int().min(1).max(100) })).max(100) }).strict().parse(req.body);
  const ids = items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'DUPLICATE_CART_ITEM', 'Each product can appear only once');
  const cart = await Cart.findOneAndUpdate({ customerId: (req as AuthRequest).auth!.userId }, { items }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  res.json({ data: cart });
}));

export const orderRouter = Router();
const checkoutSchema = z.object({ items: z.array(z.object({ productId: z.string().regex(/^[0-9a-fA-F]{24}$/), quantity: z.number().int().min(1).max(100) })).min(1).max(100) }).strict();

orderRouter.post('/checkout', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const customerId = (req as AuthRequest).auth!.userId;
  const idempotencyKey = req.header('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 128) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key header (1–128 characters)');
  const { items } = checkoutSchema.parse(req.body);
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw new AppError(400, 'DUPLICATE_ORDER_ITEM', 'Each product can appear only once');
  const prior = await Order.findOne({ customerId, idempotencyKey });
  if (prior) {
    const payment = await Payment.findOne({ orderId: prior._id });
    return res.status(200).json({ data: { order: prior, payment } });
  }

  const session = await mongoose.startSession();
  let createdOrder: InstanceType<typeof Order> | null = null;
  let createdPayment: InstanceType<typeof Payment> | null = null;
  try {
    await session.withTransaction(async () => {
      const productIds = items.map((item) => item.productId);
      const products = await Product.find({ _id: { $in: productIds }, status: 'published' }).session(session);
      if (products.length !== items.length) throw new AppError(409, 'PRODUCT_UNAVAILABLE', 'One or more products are unavailable');
      const byId = new Map(products.map((product) => [String(product._id), product]));
      const vendorGroups = new Map<string, { vendorId: unknown; storeId: unknown; subtotalPaise: number; items: Array<{ productId: unknown; name: string; quantity: number; unitPricePaise: number; lineTotalPaise: number }> }>();
      let subtotalPaise = 0;
      for (const item of items) {
        const product = byId.get(item.productId)!;
        const lineTotalPaise = product.pricePaise * item.quantity;
        if (!Number.isSafeInteger(lineTotalPaise)) throw new AppError(400, 'INVALID_TOTAL', 'Order total exceeds supported amount');
        const groupKey = String(product.vendorId);
        const group = vendorGroups.get(groupKey) ?? { vendorId: product.vendorId, storeId: product.storeId, subtotalPaise: 0, items: [] };
        group.subtotalPaise += lineTotalPaise;
        group.items.push({ productId: product._id, name: product.name, quantity: item.quantity, unitPricePaise: product.pricePaise, lineTotalPaise });
        vendorGroups.set(groupKey, group);
        subtotalPaise += lineTotalPaise;
        if (!Number.isSafeInteger(subtotalPaise)) throw new AppError(400, 'INVALID_TOTAL', 'Order total exceeds supported amount');
      }
      for (const item of items) {
        const reserved = await Product.updateOne({ _id: item.productId, status: 'published', stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session });
        if (reserved.modifiedCount !== 1) throw new AppError(409, 'INSUFFICIENT_STOCK', 'One or more products do not have enough stock');
      }
      const orderDocs = await Order.create([{
        customerId, idempotencyKey, status: 'pending_payment', currency: 'INR', subtotalPaise, shippingPaise: 0, totalPaise: subtotalPaise,
        subOrders: [...vendorGroups.values()].map((group) => ({ ...group, status: 'pending' })),
      }], { session });
      createdOrder = orderDocs[0] ?? null;
      if (!createdOrder) throw new Error('Order creation failed');
      const paymentDocs = await Payment.create([{ orderId: createdOrder._id, customerId, amountPaise: subtotalPaise, status: 'pending' }], { session });
      createdPayment = paymentDocs[0] ?? null;
      await Cart.deleteOne({ customerId }, { session });
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await Order.findOne({ customerId, idempotencyKey });
      if (duplicate) return res.status(200).json({ data: { order: duplicate, payment: await Payment.findOne({ orderId: duplicate._id }) } });
    }
    throw error;
  } finally { await session.endSession(); }
  return res.status(201).json({ data: { order: createdOrder, payment: createdPayment } });
}));

orderRouter.get('/', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: (req as AuthRequest).auth!.userId }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ data: orders });
}));
orderRouter.get('/:orderId', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, customerId: (req as AuthRequest).auth!.userId }).lean();
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  res.json({ data: order });
}));

orderRouter.post('/:orderId/cancel', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const customerId = (req as AuthRequest).auth!.userId;
  const session = await mongoose.startSession();
  let result: unknown;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.orderId, customerId }).session(session);
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
      if (order.status === 'cancelled') { result = order; return; }
      if (order.status !== 'pending_payment') throw new AppError(409, 'INVALID_ORDER_STATE', 'Only unpaid orders can be cancelled');
      for (const subOrder of order.subOrders) for (const item of subOrder.items) {
        await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }, { session });
      }
      order.status = 'cancelled';
      await order.save({ session });
      await Payment.updateOne({ orderId: order._id, status: 'pending' }, { status: 'failed', providerReference: 'cancelled' }, { session });
      result = order;
    });
  } finally { await session.endSession(); }
  res.json({ data: result });
}));

export const paymentRouter = Router();
paymentRouter.post('/:paymentId/confirm', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const customerId = (req as AuthRequest).auth!.userId;
  const session = await mongoose.startSession();
  let response: unknown;
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ _id: req.params.paymentId, customerId }).session(session);
      if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
      if (payment.status === 'succeeded') { response = payment; return; }
      if (payment.status !== 'pending') throw new AppError(409, 'INVALID_PAYMENT_STATE', 'Payment cannot be confirmed');
      const order = await Order.findOne({ _id: payment.orderId, customerId, status: 'pending_payment' }).session(session);
      if (!order) throw new AppError(409, 'INVALID_ORDER_STATE', 'Order is not awaiting payment');
      // Simulated provider: a successful confirmation, with no card data collected.
      payment.status = 'succeeded';
      payment.providerReference = `sim_${String(payment._id)}`;
      order.status = 'paid';
      for (const subOrder of order.subOrders) subOrder.status = 'processing';
      await payment.save({ session });
      await order.save({ session });
      response = payment;
    });
  } finally { await session.endSession(); }
  res.json({ data: response });
}));
paymentRouter.get('/:paymentId', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, customerId: (req as AuthRequest).auth!.userId }).lean();
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  res.json({ data: payment });
}));
