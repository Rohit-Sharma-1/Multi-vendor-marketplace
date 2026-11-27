import mongoose, { Schema, Types } from 'mongoose';

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'vendor', 'admin'], default: 'customer', required: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  refreshTokenHash: { type: String, select: false },
  refreshTokenExpiresAt: Date,
}, { timestamps: true });

const vendorSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  businessName: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
}, { timestamps: true });

const storeSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: 'VendorProfile', required: true, unique: true },
  name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' }, active: { type: Boolean, default: true },
}, { timestamps: true });

const categorySchema = new Schema({ name: { type: String, required: true }, slug: { type: String, required: true, unique: true }, active: { type: Boolean, default: true } }, { timestamps: true });
const productSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: 'VendorProfile', required: true, index: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }, categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  name: { type: String, required: true, trim: true }, description: { type: String, default: '' },
  pricePaise: { type: Number, required: true, min: 1 }, stock: { type: Number, required: true, min: 0, default: 0 },
  status: { type: String, enum: ['draft', 'pending', 'published', 'rejected'], default: 'draft', index: true },
}, { timestamps: true });
productSchema.index({ status: 1, categoryId: 1, name: 1 });

const cartSchema = new Schema({ customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, items: [{ productId: { type: Schema.Types.ObjectId, ref: 'Product' }, quantity: { type: Number, min: 1, required: true } }] }, { timestamps: true });
const orderSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, idempotencyKey: { type: String, required: true },
  status: { type: String, enum: ['pending_payment', 'paid', 'cancelled', 'payment_failed'], default: 'pending_payment', index: true },
  currency: { type: String, default: 'INR' }, subtotalPaise: { type: Number, required: true }, shippingPaise: { type: Number, required: true, default: 0 }, totalPaise: { type: Number, required: true },
  subOrders: [{ vendorId: { type: Schema.Types.ObjectId, ref: 'VendorProfile' }, storeId: { type: Schema.Types.ObjectId, ref: 'Store' }, status: { type: String, default: 'pending' }, subtotalPaise: Number,
    items: [{ productId: Schema.Types.ObjectId, name: String, quantity: Number, unitPricePaise: Number, lineTotalPaise: Number }] }],
}, { timestamps: true });
orderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
const paymentSchema = new Schema({ orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true }, customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, amountPaise: { type: Number, required: true }, status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' }, providerReference: String }, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const VendorProfile = mongoose.model('VendorProfile', vendorSchema);
export const Store = mongoose.model('Store', storeSchema);
export const Category = mongoose.model('Category', categorySchema);
export const Product = mongoose.model('Product', productSchema);
export const Cart = mongoose.model('Cart', cartSchema);
export const Order = mongoose.model('Order', orderSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export type Id = Types.ObjectId;
