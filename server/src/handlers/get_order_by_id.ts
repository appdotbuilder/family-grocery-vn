import { db } from '../db';
import { ordersTable, orderItemsTable, productsTable, usersTable } from '../db/schema';
import { type Order, type OrderItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export type OrderWithItems = Order & {
    items: (OrderItem & { product_name: string, product_unit: string })[];
    customer_name: string;
    seller_name: string;
};

export async function getOrderById(id: number, userId?: number, userRole?: 'customer' | 'seller'): Promise<OrderWithItems | null> {
    try {
        // First, fetch the order with customer and seller information
        const orderResults = await db.select({
            // Order fields
            id: ordersTable.id,
            customer_id: ordersTable.customer_id,
            seller_id: ordersTable.seller_id,
            total_value: ordersTable.total_value,
            status: ordersTable.status,
            payment_method: ordersTable.payment_method,
            delivery_address: ordersTable.delivery_address,
            customer_notes: ordersTable.customer_notes,
            created_at: ordersTable.created_at,
            updated_at: ordersTable.updated_at,
            // Customer and seller names
            customer_name: usersTable.full_name,
        })
        .from(ordersTable)
        .innerJoin(usersTable, eq(ordersTable.customer_id, usersTable.id))
        .where(eq(ordersTable.id, id))
        .execute();

        if (orderResults.length === 0) {
            return null;
        }

        const orderData = orderResults[0];

        // Get seller information separately
        const sellerResults = await db.select({
            seller_name: usersTable.full_name,
        })
        .from(usersTable)
        .where(eq(usersTable.id, orderData.seller_id))
        .execute();

        if (sellerResults.length === 0) {
            return null;
        }

        const sellerData = sellerResults[0];

        // Check authorization if userId and userRole are provided
        if (userId !== undefined && userRole !== undefined) {
            if (userRole === 'customer' && orderData.customer_id !== userId) {
                return null; // Customer can only see their own orders
            }
            if (userRole === 'seller' && orderData.seller_id !== userId) {
                return null; // Seller can only see orders for their products
            }
        }

        // Fetch order items with product details
        const orderItemResults = await db.select({
            // Order item fields
            id: orderItemsTable.id,
            order_id: orderItemsTable.order_id,
            product_id: orderItemsTable.product_id,
            quantity: orderItemsTable.quantity,
            unit_price: orderItemsTable.unit_price,
            total_price: orderItemsTable.total_price,
            created_at: orderItemsTable.created_at,
            // Product details
            product_name: productsTable.name,
            product_unit: productsTable.unit_of_measurement,
        })
        .from(orderItemsTable)
        .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
        .where(eq(orderItemsTable.order_id, id))
        .execute();

        // Convert numeric fields and construct the result
        const order: OrderWithItems = {
            id: orderData.id,
            customer_id: orderData.customer_id,
            seller_id: orderData.seller_id,
            total_value: parseFloat(orderData.total_value), // Convert numeric to number
            status: orderData.status,
            payment_method: orderData.payment_method,
            delivery_address: orderData.delivery_address,
            customer_notes: orderData.customer_notes,
            created_at: orderData.created_at,
            updated_at: orderData.updated_at,
            customer_name: orderData.customer_name,
            seller_name: sellerData.seller_name,
            items: orderItemResults.map(item => ({
                id: item.id,
                order_id: item.order_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: parseFloat(item.unit_price), // Convert numeric to number
                total_price: parseFloat(item.total_price), // Convert numeric to number
                created_at: item.created_at,
                product_name: item.product_name,
                product_unit: item.product_unit,
            }))
        };

        return order;
    } catch (error) {
        console.error('Get order by ID failed:', error);
        throw error;
    }
}