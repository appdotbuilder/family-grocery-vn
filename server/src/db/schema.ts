import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer,
  pgEnum,
  jsonb 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const productCategoryEnum = pgEnum('product_category', [
  'meat',
  'poultry', 
  'seafood',
  'eggs_dairy',
  'vegetables',
  'fruits',
  'spices_condiments',
  'grains_cereals',
  'beverages',
  'others'
]);

export const unitOfMeasurementEnum = pgEnum('unit_of_measurement', [
  'kg',
  'gram',
  'piece',
  'dozen',
  'liter',
  'bottle',
  'pack',
  'box',
  'bundle'
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending_confirmation',
  'confirmed',
  'delivering',
  'delivered',
  'cancelled'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cod',
  'bank_transfer',
  'momo',
  'zalopay'
]);

export const userRoleEnum = pgEnum('user_role', ['customer', 'seller']);

// Users table (both customers and sellers)
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  phone: text('phone').notNull(),
  address: text('address'), // Nullable by default
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  category: productCategoryEnum('category').notNull(),
  origin: text('origin').notNull(), // Xuất xứ
  stock_quantity: integer('stock_quantity').notNull(),
  unit_of_measurement: unitOfMeasurementEnum('unit_of_measurement').notNull(),
  images: jsonb('images').$type<string[]>().notNull().default([]), // Array of image URLs
  seller_id: integer('seller_id').references(() => usersTable.id).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  customer_id: integer('customer_id').references(() => usersTable.id).notNull(),
  seller_id: integer('seller_id').references(() => usersTable.id).notNull(),
  total_value: numeric('total_value', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending_confirmation'),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  delivery_address: text('delivery_address').notNull(),
  customer_notes: text('customer_notes'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Order items table (junction table between orders and products)
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').references(() => ordersTable.id).notNull(),
  product_id: integer('product_id').references(() => productsTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  products: many(productsTable),
  ordersAsCustomer: many(ordersTable, { relationName: 'customer' }),
  ordersAsSeller: many(ordersTable, { relationName: 'seller' }),
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  seller: one(usersTable, {
    fields: [productsTable.seller_id],
    references: [usersTable.id],
  }),
  orderItems: many(orderItemsTable),
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  customer: one(usersTable, {
    fields: [ordersTable.customer_id],
    references: [usersTable.id],
    relationName: 'customer',
  }),
  seller: one(usersTable, {
    fields: [ordersTable.seller_id],
    references: [usersTable.id],
    relationName: 'seller',
  }),
  items: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  products: productsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;