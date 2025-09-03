import { z } from 'zod';

// Enums for various statuses and categories
export const productCategorySchema = z.enum([
  'meat', // Thịt
  'poultry', // Gia cầm
  'seafood', // Hải sản
  'eggs_dairy', // Trứng và sữa
  'vegetables', // Rau củ
  'fruits', // Trái cây
  'spices_condiments', // Gia vị
  'grains_cereals', // Ngũ cốc
  'beverages', // Đồ uống
  'others' // Khác
]);

export const unitOfMeasurementSchema = z.enum([
  'kg', // Kilogram
  'gram', // Gram
  'piece', // Cái/con
  'dozen', // Tá
  'liter', // Lít
  'bottle', // Chai
  'pack', // Gói
  'box', // Hộp
  'bundle' // Bó
]);

export const orderStatusSchema = z.enum([
  'pending_confirmation', // Chờ xác nhận
  'confirmed', // Đã xác nhận
  'delivering', // Đang giao hàng
  'delivered', // Đã giao hàng
  'cancelled' // Đã hủy
]);

export const paymentMethodSchema = z.enum([
  'cod', // Cash on Delivery - Thanh toán khi nhận hàng
  'bank_transfer', // Chuyển khoản ngân hàng
  'momo', // Ví điện tử MoMo
  'zalopay' // Ví điện tử ZaloPay
]);

// Product schemas
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  category: productCategorySchema,
  origin: z.string(), // Xuất xứ (e.g., "Đồng Tháp", "Cà Mau")
  stock_quantity: z.number().int().nonnegative(),
  unit_of_measurement: unitOfMeasurementSchema,
  images: z.array(z.string()).default([]), // Array of image URLs
  seller_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

export const createProductInputSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được để trống'),
  description: z.string().min(1, 'Mô tả sản phẩm không được để trống'),
  price: z.number().positive('Giá phải lớn hơn 0'),
  category: productCategorySchema,
  origin: z.string().min(1, 'Xuất xứ không được để trống'),
  stock_quantity: z.number().int().nonnegative('Số lượng tồn kho không được âm'),
  unit_of_measurement: unitOfMeasurementSchema,
  images: z.array(z.string()).optional().default([]),
  seller_id: z.number()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  category: productCategorySchema.optional(),
  origin: z.string().min(1).optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  unit_of_measurement: unitOfMeasurementSchema.optional(),
  images: z.array(z.string()).optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// User schemas (customers and sellers)
export const userRoleSchema = z.enum(['customer', 'seller']);

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string(),
  phone: z.string(),
  address: z.string().nullable(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  full_name: z.string().min(1, 'Họ tên không được để trống'),
  phone: z.string().regex(/^(\+84|84|0)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại không hợp lệ'),
  address: z.string().nullable(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Order schemas
export const orderSchema = z.object({
  id: z.number(),
  customer_id: z.number(),
  seller_id: z.number(),
  total_value: z.number().positive(),
  status: orderStatusSchema,
  payment_method: paymentMethodSchema,
  delivery_address: z.string(),
  customer_notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

export const createOrderInputSchema = z.object({
  customer_id: z.number(),
  seller_id: z.number(),
  payment_method: paymentMethodSchema,
  delivery_address: z.string().min(1, 'Địa chỉ giao hàng không được để trống'),
  customer_notes: z.string().nullable(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive('Số lượng phải lớn hơn 0'),
    unit_price: z.number().positive('Giá không được âm')
  })).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm')
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const updateOrderStatusInputSchema = z.object({
  id: z.number(),
  status: orderStatusSchema,
  seller_id: z.number() // Only the seller can update order status
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// Order item schemas
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Query schemas for filtering and pagination
export const getProductsInputSchema = z.object({
  category: productCategorySchema.optional(),
  seller_id: z.number().optional(),
  search: z.string().optional(),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().positive().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

export type GetProductsInput = z.infer<typeof getProductsInputSchema>;

export const getOrdersInputSchema = z.object({
  customer_id: z.number().optional(),
  seller_id: z.number().optional(),
  status: orderStatusSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(10)
});

export type GetOrdersInput = z.infer<typeof getOrdersInputSchema>;