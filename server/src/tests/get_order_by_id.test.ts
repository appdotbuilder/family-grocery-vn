import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, ordersTable, orderItemsTable } from '../db/schema';
import { getOrderById, type OrderWithItems } from '../handlers/get_order_by_id';
import { eq } from 'drizzle-orm';

describe('getOrderById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let customer: any;
  let seller: any;
  let product: any;
  let order: any;
  let orderItem: any;

  beforeEach(async () => {
    // Create test customer
    const customerResults = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        full_name: 'Test Customer',
        phone: '0123456789',
        address: '123 Customer St',
        role: 'customer'
      })
      .returning()
      .execute();
    customer = customerResults[0];

    // Create test seller
    const sellerResults = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        full_name: 'Test Seller',
        phone: '0987654321',
        address: '456 Seller Ave',
        role: 'seller'
      })
      .returning()
      .execute();
    seller = sellerResults[0];

    // Create test product
    const productResults = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A test product',
        price: '25.99',
        category: 'vegetables',
        origin: 'Test Farm',
        stock_quantity: 100,
        unit_of_measurement: 'kg',
        images: ['test-image.jpg'],
        seller_id: seller.id
      })
      .returning()
      .execute();
    product = productResults[0];

    // Create test order
    const orderResults = await db.insert(ordersTable)
      .values({
        customer_id: customer.id,
        seller_id: seller.id,
        total_value: '51.98',
        status: 'confirmed',
        payment_method: 'cod',
        delivery_address: '789 Delivery Road',
        customer_notes: 'Please deliver in the morning'
      })
      .returning()
      .execute();
    order = orderResults[0];

    // Create test order item
    const orderItemResults = await db.insert(orderItemsTable)
      .values({
        order_id: order.id,
        product_id: product.id,
        quantity: 2,
        unit_price: '25.99',
        total_price: '51.98'
      })
      .returning()
      .execute();
    orderItem = orderItemResults[0];
  });

  it('should return order with all details when order exists', async () => {
    const result = await getOrderById(order.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(order.id);
    expect(result!.customer_id).toBe(customer.id);
    expect(result!.seller_id).toBe(seller.id);
    expect(result!.total_value).toBe(51.98);
    expect(result!.status).toBe('confirmed');
    expect(result!.payment_method).toBe('cod');
    expect(result!.delivery_address).toBe('789 Delivery Road');
    expect(result!.customer_notes).toBe('Please deliver in the morning');
    expect(result!.customer_name).toBe('Test Customer');
    expect(result!.seller_name).toBe('Test Seller');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Check order items
    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];
    expect(item.id).toBe(orderItem.id);
    expect(item.order_id).toBe(order.id);
    expect(item.product_id).toBe(product.id);
    expect(item.quantity).toBe(2);
    expect(item.unit_price).toBe(25.99);
    expect(item.total_price).toBe(51.98);
    expect(item.product_name).toBe('Test Product');
    expect(item.product_unit).toBe('kg');
    expect(item.created_at).toBeInstanceOf(Date);
  });

  it('should return null when order does not exist', async () => {
    const result = await getOrderById(99999);

    expect(result).toBeNull();
  });

  it('should allow customer to see their own order', async () => {
    const result = await getOrderById(order.id, customer.id, 'customer');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(order.id);
    expect(result!.customer_name).toBe('Test Customer');
  });

  it('should not allow customer to see other customers orders', async () => {
    // Create another customer
    const otherCustomerResults = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        full_name: 'Other Customer',
        phone: '0111111111',
        address: '999 Other St',
        role: 'customer'
      })
      .returning()
      .execute();
    const otherCustomer = otherCustomerResults[0];

    const result = await getOrderById(order.id, otherCustomer.id, 'customer');

    expect(result).toBeNull();
  });

  it('should allow seller to see orders for their products', async () => {
    const result = await getOrderById(order.id, seller.id, 'seller');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(order.id);
    expect(result!.seller_name).toBe('Test Seller');
  });

  it('should not allow seller to see orders for other sellers products', async () => {
    // Create another seller
    const otherSellerResults = await db.insert(usersTable)
      .values({
        email: 'otherseller@test.com',
        full_name: 'Other Seller',
        phone: '0222222222',
        address: '888 Other Seller Ave',
        role: 'seller'
      })
      .returning()
      .execute();
    const otherSeller = otherSellerResults[0];

    const result = await getOrderById(order.id, otherSeller.id, 'seller');

    expect(result).toBeNull();
  });

  it('should handle order with multiple items', async () => {
    // Create another product
    const product2Results = await db.insert(productsTable)
      .values({
        name: 'Second Product',
        description: 'Another test product',
        price: '15.50',
        category: 'fruits',
        origin: 'Test Orchard',
        stock_quantity: 50,
        unit_of_measurement: 'piece',
        images: ['test-image2.jpg'],
        seller_id: seller.id
      })
      .returning()
      .execute();
    const product2 = product2Results[0];

    // Add second order item
    await db.insert(orderItemsTable)
      .values({
        order_id: order.id,
        product_id: product2.id,
        quantity: 3,
        unit_price: '15.50',
        total_price: '46.50'
      })
      .execute();

    // Update order total
    await db.update(ordersTable)
      .set({ total_value: '98.48' }) // 51.98 + 46.50
      .where(eq(ordersTable.id, order.id))
      .execute();

    const result = await getOrderById(order.id);

    expect(result).not.toBeNull();
    expect(result!.total_value).toBe(98.48);
    expect(result!.items).toHaveLength(2);

    const items = result!.items.sort((a, b) => a.id - b.id);
    
    // First item
    expect(items[0].product_name).toBe('Test Product');
    expect(items[0].quantity).toBe(2);
    expect(items[0].unit_price).toBe(25.99);
    expect(items[0].total_price).toBe(51.98);
    expect(items[0].product_unit).toBe('kg');

    // Second item
    expect(items[1].product_name).toBe('Second Product');
    expect(items[1].quantity).toBe(3);
    expect(items[1].unit_price).toBe(15.50);
    expect(items[1].total_price).toBe(46.50);
    expect(items[1].product_unit).toBe('piece');
  });

  it('should handle order with null customer notes', async () => {
    // Create order without customer notes
    const orderWithoutNotesResults = await db.insert(ordersTable)
      .values({
        customer_id: customer.id,
        seller_id: seller.id,
        total_value: '25.99',
        status: 'pending_confirmation',
        payment_method: 'bank_transfer',
        delivery_address: '123 Test Address',
        customer_notes: null
      })
      .returning()
      .execute();
    const orderWithoutNotes = orderWithoutNotesResults[0];

    // Add order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderWithoutNotes.id,
        product_id: product.id,
        quantity: 1,
        unit_price: '25.99',
        total_price: '25.99'
      })
      .execute();

    const result = await getOrderById(orderWithoutNotes.id);

    expect(result).not.toBeNull();
    expect(result!.customer_notes).toBeNull();
    expect(result!.status).toBe('pending_confirmation');
    expect(result!.payment_method).toBe('bank_transfer');
  });

  it('should verify numeric field conversions', async () => {
    const result = await getOrderById(order.id);

    expect(result).not.toBeNull();
    
    // Verify all numeric fields are converted to numbers
    expect(typeof result!.total_value).toBe('number');
    expect(result!.total_value).toBe(51.98);

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];
    expect(typeof item.unit_price).toBe('number');
    expect(typeof item.total_price).toBe('number');
    expect(item.unit_price).toBe(25.99);
    expect(item.total_price).toBe(51.98);
  });
});