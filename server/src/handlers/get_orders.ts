import { db } from '../db';
import { ordersTable } from '../db/schema';
import { type GetOrdersInput, type Order } from '../schema';
import { eq, and, SQL, count } from 'drizzle-orm';

export async function getOrders(input?: GetOrdersInput): Promise<{ orders: Order[], total: number }> {
  try {
    // Apply default values if input is not provided
    const {
      customer_id,
      seller_id,
      status,
      page = 1,
      limit = 10
    } = input || {};

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (customer_id !== undefined) {
      conditions.push(eq(ordersTable.customer_id, customer_id));
    }

    if (seller_id !== undefined) {
      conditions.push(eq(ordersTable.seller_id, seller_id));
    }

    if (status !== undefined) {
      conditions.push(eq(ordersTable.status, status));
    }

    // Build and execute the main query
    const whereClause = conditions.length === 0 
      ? undefined 
      : (conditions.length === 1 ? conditions[0] : and(...conditions));

    const results = await db.select()
      .from(ordersTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .execute();

    // Convert numeric fields back to numbers and format dates
    const orders: Order[] = results.map(order => ({
      ...order,
      total_value: parseFloat(order.total_value), // Convert numeric field to number
      created_at: order.created_at,
      updated_at: order.updated_at
    }));

    // Get total count for pagination
    const countResult = await db.select({ count: count() })
      .from(ordersTable)
      .where(whereClause)
      .execute();

    const total = countResult[0]?.count || 0;

    return {
      orders,
      total
    };
  } catch (error) {
    console.error('Get orders failed:', error);
    throw error;
  }
}