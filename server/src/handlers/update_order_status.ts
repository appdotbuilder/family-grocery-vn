import { db } from '../db';
import { ordersTable, orderItemsTable, productsTable } from '../db/schema';
import { type UpdateOrderStatusInput, type Order } from '../schema';
import { eq, and } from 'drizzle-orm';

// Define valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending_confirmation': ['confirmed', 'cancelled'],
  'confirmed': ['delivering', 'cancelled'],
  'delivering': ['delivered', 'cancelled'],
  'delivered': [], // Terminal state - no transitions allowed
  'cancelled': [] // Terminal state - no transitions allowed
};

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order | null> {
  try {
    // First, verify order exists and belongs to the seller
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, input.id),
          eq(ordersTable.seller_id, input.seller_id)
        )
      )
      .execute();

    if (existingOrders.length === 0) {
      return null; // Order not found or doesn't belong to seller
    }

    const existingOrder = existingOrders[0];

    // Check if status transition is valid
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existingOrder.status];
    if (!allowedTransitions.includes(input.status)) {
      throw new Error(`Cannot transition from ${existingOrder.status} to ${input.status}`);
    }

    // If cancelling an order, restore stock quantities
    if (input.status === 'cancelled' && existingOrder.status !== 'cancelled') {
      await restoreStockQuantities(input.id);
    }

    // Update order status and timestamp
    const updatedOrders = await db.update(ordersTable)
      .set({
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const updatedOrder = updatedOrders[0];
    return {
      ...updatedOrder,
      total_value: parseFloat(updatedOrder.total_value)
    };
  } catch (error) {
    console.error('Order status update failed:', error);
    throw error;
  }
}

// Helper function to restore stock quantities when order is cancelled
async function restoreStockQuantities(orderId: number): Promise<void> {
  // Get all order items for this order
  const orderItems = await db.select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.order_id, orderId))
    .execute();

  // Restore stock for each product
  for (const item of orderItems) {
    // Get current product stock
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, item.product_id))
      .execute();

    if (products.length > 0) {
      const currentStock = products[0].stock_quantity;
      await db.update(productsTable)
        .set({
          stock_quantity: currentStock + item.quantity,
          updated_at: new Date()
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();
    }
  }
}