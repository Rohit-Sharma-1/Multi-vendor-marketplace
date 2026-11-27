export type Role = 'customer' | 'vendor' | 'admin';
export interface User { id: string; email: string; role: Role; status?: string }
export interface Category { _id: string; name: string; slug: string; active: boolean }
export interface Product { _id: string; vendorId: string; storeId: string; categoryId: string; name: string; description: string; pricePaise: number; stock: number; status: 'draft'|'pending'|'published'|'rejected'; createdAt?: string }
export interface Vendor { _id: string; userId: string; businessName: string; status: 'pending'|'approved'|'rejected'|'suspended'; createdAt?: string }
export interface Store { _id: string; vendorId: string; name: string; slug: string; description: string; active: boolean }
export interface CartItem { productId: string|Product; quantity: number }
export interface Cart { items: CartItem[] }
export interface OrderItem { productId: string; name: string; quantity: number; unitPricePaise: number; lineTotalPaise: number }
export interface SubOrder { vendorId: string; storeId: string; status: string; subtotalPaise: number; items: OrderItem[] }
export interface Order { _id: string; status: string; currency: string; subtotalPaise: number; shippingPaise: number; totalPaise: number; subOrders: SubOrder[]; createdAt: string }
export interface Payment { _id: string; orderId: string; amountPaise: number; status: string }
export interface ApiErrorShape { error?: { code?: string; message?: string } }
