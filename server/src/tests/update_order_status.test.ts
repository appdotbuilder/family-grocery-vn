import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, ordersTable, orderItemsTable } from '../db/schema';
import { type UpdateOrderStatusInput } from '../schema';
import { updateOrderStatus } from '../handlers/update_order_status';
import { eq } from 'drizzle-orm';

describe('updateOrderStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let sellerId: number;
  let customerId: number;
  let productId: number;
  let orderId: number;

  beforeEach(async () => {
    // Create test users
    const sellers = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        full_name: 'Test Seller',
        phone: '0901234567',
        address: '123 Seller Street',
        role: 'seller'
      })
      .returning()
      .execute();
    sellerId = sellers[0].id;

    const customers = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        full_name: 'Test Customer',
        phone: '0987654321',
        address: '456 Customer Street',
        role: 'customer'
      })
      .returning()
      .execute();
    customerId = customers[0].id;

    // Create test product
    const products = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing',
        price: '19.99',
        category: 'vegetables',
        origin: 'Đồng Tháp',
        stock_quantity: 100,
        unit_of_measurement: 'kg',
        images: [],
        seller_id: sellerId
      })
      .returning()
      .execute();
    productId = products[0].id;

    // Create test order
    const orders = await db.insert(ordersTable)
      .values({
        customer_id: customerId,
        seller_id: sellerId,
        total_value: '59.97',
        status: 'pending_confirmation',
        payment_method: 'cod',
        delivery_address: '456 Customer Street',
        customer_notes: 'Test order'
      })
      .returning()
      .execute();
    orderId = orders[0].id;

    // Create order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: productId,
        quantity: 3,
        unit_price: '19.99',
        total_price: '59.97'
      })
      .execute();

    // Update product stock to reflect the order
    await db.update(productsTable)
      .set({ stock_quantity: 97 })
      .where(eq(productsTable.id, productId))
      .execute();
  });

  it('should update order status successfully', async () => {
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'confirmed',
      seller_id: sellerId
    };

    const result = await updateOrderStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('confirmed');
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(typeof result!.total_value).toBe('number');
    expect(result!.total_value).toEqual(59.97);
  });

  it('should update order in database', async () => {
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'confirmed',
      seller_id: sellerId
    };

    await updateOrderStatus(input);

    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    expect(orders).toHaveLength(1);
    expect(orders[0].status).toEqual('confirmed');
    expect(orders[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent order', async () => {
    const input: UpdateOrderStatusInput = {
      id: 99999,
      status: 'confirmed',
      seller_id: sellerId
    };

    const result = await updateOrderStatus(input);

    expect(result).toBeNull();
  });

  it('should return null when seller does not own the order', async () => {
    // Create another seller
    const otherSellers = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        full_name: 'Other Seller',
        phone: '0911111111',
        address: '789 Other Street',
        role: 'seller'
      })
      .returning()
      .execute();

    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'confirmed',
      seller_id: otherSellers[0].id
    };

    const result = await updateOrderStatus(input);

    expect(result).toBeNull();
  });

  it('should allow valid status transitions', async () => {
    // pending_confirmation -> confirmed
    let input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'confirmed',
      seller_id: sellerId
    };
    let result = await updateOrderStatus(input);
    expect(result!.status).toEqual('confirmed');

    // confirmed -> delivering
    input = {
      id: orderId,
      status: 'delivering',
      seller_id: sellerId
    };
    result = await updateOrderStatus(input);
    expect(result!.status).toEqual('delivering');

    // delivering -> delivered
    input = {
      id: orderId,
      status: 'delivered',
      seller_id: sellerId
    };
    result = await updateOrderStatus(input);
    expect(result!.status).toEqual('delivered');
  });

  it('should reject invalid status transitions', async () => {
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'delivered', // Cannot go directly from pending_confirmation to delivered
      seller_id: sellerId
    };

    await expect(updateOrderStatus(input)).rejects.toThrow(/Cannot transition from/);
  });

  it('should reject transitions from terminal states', async () => {
    // First move to delivered state
    await updateOrderStatus({
      id: orderId,
      status: 'confirmed',
      seller_id: sellerId
    });
    await updateOrderStatus({
      id: orderId,
      status: 'delivering',
      seller_id: sellerId
    });
    await updateOrderStatus({
      id: orderId,
      status: 'delivered',
      seller_id: sellerId
    });

    // Now try to change from delivered (should fail)
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'cancelled',
      seller_id: sellerId
    };

    await expect(updateOrderStatus(input)).rejects.toThrow(/Cannot transition from delivered/);
  });

  it('should restore stock quantities when order is cancelled', async () => {
    // Check initial product stock (should be 97 after order creation)
    let products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(products[0].stock_quantity).toEqual(97);

    // Cancel the order
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'cancelled',
      seller_id: sellerId
    };

    const result = await updateOrderStatus(input);

    expect(result!.status).toEqual('cancelled');

    // Check that stock was restored (should be back to 100)
    products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(products[0].stock_quantity).toEqual(100);
  });

  it('should not restore stock when cancelling already cancelled order', async () => {
    // First cancel the order
    await updateOrderStatus({
      id: orderId,
      status: 'cancelled',
      seller_id: sellerId
    });

    // Check stock after first cancellation
    let products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(products[0].stock_quantity).toEqual(100);

    // Try to cancel again (should fail due to invalid transition)
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'cancelled',
      seller_id: sellerId
    };

    await expect(updateOrderStatus(input)).rejects.toThrow(/Cannot transition from cancelled/);

    // Stock should remain unchanged
    products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(products[0].stock_quantity).toEqual(100);
  });

  it('should allow cancellation from confirmed status and restore stock', async () => {
    // First confirm the order
    await updateOrderStatus({
      id: orderId,
      status: 'confirmed',
      seller_id: sellerId
    });

    // Check stock is still reduced
    let products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(products[0].stock_quantity).toEqual(97);

    // Cancel from confirmed status
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'cancelled',
      seller_id: sellerId
    };

    const result = await updateOrderStatus(input);

    expect(result!.status).toEqual('cancelled');

    // Check stock was restored
    products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(products[0].stock_quantity).toEqual(100);
  });

  it('should handle orders with multiple items when restoring stock', async () => {
    // Add another product and order item
    const products2 = await db.insert(productsTable)
      .values({
        name: 'Second Product',
        description: 'Another test product',
        price: '29.99',
        category: 'fruits',
        origin: 'Cà Mau',
        stock_quantity: 50,
        unit_of_measurement: 'kg',
        images: [],
        seller_id: sellerId
      })
      .returning()
      .execute();

    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: products2[0].id,
        quantity: 2,
        unit_price: '29.99',
        total_price: '59.98'
      })
      .execute();

    // Reduce stock for second product as well
    await db.update(productsTable)
      .set({ stock_quantity: 48 })
      .where(eq(productsTable.id, products2[0].id))
      .execute();

    // Cancel the order
    const input: UpdateOrderStatusInput = {
      id: orderId,
      status: 'cancelled',
      seller_id: sellerId
    };

    await updateOrderStatus(input);

    // Check both products had their stock restored
    const product1 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    expect(product1[0].stock_quantity).toEqual(100);

    const product2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, products2[0].id))
      .execute();
    expect(product2[0].stock_quantity).toEqual(50);
  });
});