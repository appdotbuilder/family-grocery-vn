import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema,
  createProductInputSchema, 
  updateProductInputSchema,
  getProductsInputSchema,
  createOrderInputSchema,
  getOrdersInputSchema,
  updateOrderStatusInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { createProduct } from './handlers/create_product';
import { getProducts } from './handlers/get_products';
import { getProductById } from './handlers/get_product_by_id';
import { updateProduct } from './handlers/update_product';
import { createOrder } from './handlers/create_order';
import { getOrders } from './handlers/get_orders';
import { getOrderById } from './handlers/get_order_by_id';
import { updateOrderStatus } from './handlers/update_order_status';
import { getUserById } from './handlers/get_user_by_id';
import { getSellers } from './handlers/get_sellers';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUserById: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserById(input)),

  getSellers: publicProcedure
    .query(() => getSellers()),

  // Product management
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),

  getProducts: publicProcedure
    .input(getProductsInputSchema)
    .query(({ input }) => getProducts(input)),

  getProductById: publicProcedure
    .input(z.number())
    .query(({ input }) => getProductById(input)),

  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),

  // Order management
  createOrder: publicProcedure
    .input(createOrderInputSchema)
    .mutation(({ input }) => createOrder(input)),

  getOrders: publicProcedure
    .input(getOrdersInputSchema)
    .query(({ input }) => getOrders(input)),

  getOrderById: publicProcedure
    .input(z.object({
      id: z.number(),
      userId: z.number().optional(),
      userRole: z.enum(['customer', 'seller']).optional()
    }))
    .query(({ input }) => getOrderById(input.id, input.userId, input.userRole)),

  updateOrderStatus: publicProcedure
    .input(updateOrderStatusInputSchema)
    .mutation(({ input }) => updateOrderStatus(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`🥬 Vietnamese Grocery Store TRPC server listening at port: ${port}`);
  console.log(`🛒 Features: Products, Orders, Customers & Sellers Management`);
  console.log(`💰 Payment Methods: COD, Bank Transfer, MoMo, ZaloPay`);
}

start();