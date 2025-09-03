import { db } from '../db';
import { ordersTable, orderItemsTable, productsTable, usersTable } from '../db/schema';
import { type CreateOrderInput, type Order } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  try {
    // Use transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // 1. Validate that customer and seller exist and have correct roles
      const customer = await tx.select()
        .from(usersTable)
        .where(and(eq(usersTable.id, input.customer_id), eq(usersTable.role, 'customer')))
        .execute();

      if (customer.length === 0) {
        throw new Error('Customer not found or invalid role');
      }

      const seller = await tx.select()
        .from(usersTable)
        .where(and(eq(usersTable.id, input.seller_id), eq(usersTable.role, 'seller')))
        .execute();

      if (seller.length === 0) {
        throw new Error('Seller not found or invalid role');
      }

      // 2. Validate product availability and calculate total
      let totalValue = 0;
      const validatedItems = [];

      for (const item of input.items) {
        // Get product and check if it belongs to the seller
        const products = await tx.select()
          .from(productsTable)
          .where(and(
            eq(productsTable.id, item.product_id),
            eq(productsTable.seller_id, input.seller_id)
          ))
          .execute();

        if (products.length === 0) {
          throw new Error(`Product ${item.product_id} not found or does not belong to seller`);
        }

        const product = products[0];

        // Check stock availability
        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`);
        }

        // Validate unit price matches current product price
        const currentPrice = parseFloat(product.price);
        if (Math.abs(item.unit_price - currentPrice) > 0.01) {
          throw new Error(`Price mismatch for product ${product.name}. Current price: ${currentPrice}, Provided: ${item.unit_price}`);
        }

        const itemTotal = item.quantity * item.unit_price;
        totalValue += itemTotal;

        validatedItems.push({
          ...item,
          total_price: itemTotal,
          current_stock: product.stock_quantity
        });
      }

      // 3. Create order record
      const orderResult = await tx.insert(ordersTable)
        .values({
          customer_id: input.customer_id,
          seller_id: input.seller_id,
          total_value: totalValue.toString(), // Convert to string for numeric column
          status: 'pending_confirmation',
          payment_method: input.payment_method,
          delivery_address: input.delivery_address,
          customer_notes: input.customer_notes
        })
        .returning()
        .execute();

      const createdOrder = orderResult[0];

      // 4. Create order items and update stock quantities
      for (const item of validatedItems) {
        // Create order item
        await tx.insert(orderItemsTable)
          .values({
            order_id: createdOrder.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price.toString(), // Convert to string for numeric column
            total_price: item.total_price.toString() // Convert to string for numeric column
          })
          .execute();

        // Update product stock
        const newStockQuantity = item.current_stock - item.quantity;
        await tx.update(productsTable)
          .set({ 
            stock_quantity: newStockQuantity,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
      }

      // Return the created order with numeric conversion
      return {
        ...createdOrder,
        total_value: parseFloat(createdOrder.total_value) // Convert back to number
      };
    });

    return result;
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
};