import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, ordersTable, orderItemsTable } from '../db/schema';
import { type CreateOrderInput } from '../schema';
import { createOrder } from '../handlers/create_order';
import { eq } from 'drizzle-orm';

describe('createOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let customerId: number;
  let sellerId: number;
  let productId1: number;
  let productId2: number;

  const setupTestData = async () => {
    // Create customer
    const customerResult = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        full_name: 'Test Customer',
        phone: '+84901234567',
        address: '123 Test Street',
        role: 'customer'
      })
      .returning()
      .execute();
    customerId = customerResult[0].id;

    // Create seller
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        full_name: 'Test Seller',
        phone: '+84987654321',
        address: '456 Seller Street',
        role: 'seller'
      })
      .returning()
      .execute();
    sellerId = sellerResult[0].id;

    // Create products
    const product1Result = await db.insert(productsTable)
      .values({
        name: 'Fresh Tomatoes',
        description: 'Organic tomatoes from Da Lat',
        price: '25.50',
        category: 'vegetables',
        origin: 'Da Lat',
        stock_quantity: 100,
        unit_of_measurement: 'kg',
        images: ['tomato1.jpg'],
        seller_id: sellerId
      })
      .returning()
      .execute();
    productId1 = product1Result[0].id;

    const product2Result = await db.insert(productsTable)
      .values({
        name: 'Fresh Lettuce',
        description: 'Green lettuce',
        price: '15.00',
        category: 'vegetables',
        origin: 'Dong Thap',
        stock_quantity: 50,
        unit_of_measurement: 'bundle',
        images: [],
        seller_id: sellerId
      })
      .returning()
      .execute();
    productId2 = product2Result[0].id;
  };

  const createValidOrderInput = (): CreateOrderInput => ({
    customer_id: customerId,
    seller_id: sellerId,
    payment_method: 'cod',
    delivery_address: '789 Delivery Address, Ho Chi Minh City',
    customer_notes: 'Please deliver in the morning',
    items: [
      {
        product_id: productId1,
        quantity: 5,
        unit_price: 25.50
      },
      {
        product_id: productId2,
        quantity: 2,
        unit_price: 15.00
      }
    ]
  });

  it('should create an order successfully', async () => {
    await setupTestData();
    const input = createValidOrderInput();

    const result = await createOrder(input);

    // Verify order properties
    expect(result.id).toBeDefined();
    expect(result.customer_id).toEqual(customerId);
    expect(result.seller_id).toEqual(sellerId);
    expect(result.total_value).toEqual(157.50); // (5 * 25.50) + (2 * 15.00) = 127.50 + 30.00
    expect(result.status).toEqual('pending_confirmation');
    expect(result.payment_method).toEqual('cod');
    expect(result.delivery_address).toEqual('789 Delivery Address, Ho Chi Minh City');
    expect(result.customer_notes).toEqual('Please deliver in the morning');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create order items in database', async () => {
    await setupTestData();
    const input = createValidOrderInput();

    const result = await createOrder(input);

    // Check order items were created
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, result.id))
      .execute();

    expect(orderItems).toHaveLength(2);

    // Check first item
    const item1 = orderItems.find(item => item.product_id === productId1);
    expect(item1).toBeDefined();
    expect(item1!.quantity).toEqual(5);
    expect(parseFloat(item1!.unit_price)).toEqual(25.50);
    expect(parseFloat(item1!.total_price)).toEqual(127.50);

    // Check second item
    const item2 = orderItems.find(item => item.product_id === productId2);
    expect(item2).toBeDefined();
    expect(item2!.quantity).toEqual(2);
    expect(parseFloat(item2!.unit_price)).toEqual(15.00);
    expect(parseFloat(item2!.total_price)).toEqual(30.00);
  });

  it('should update product stock quantities', async () => {
    await setupTestData();
    const input = createValidOrderInput();

    await createOrder(input);

    // Check updated stock quantities
    const product1 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId1))
      .execute();
    expect(product1[0].stock_quantity).toEqual(95); // 100 - 5

    const product2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId2))
      .execute();
    expect(product2[0].stock_quantity).toEqual(48); // 50 - 2
  });

  it('should save order to database', async () => {
    await setupTestData();
    const input = createValidOrderInput();

    const result = await createOrder(input);

    // Verify order in database
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, result.id))
      .execute();

    expect(orders).toHaveLength(1);
    const order = orders[0];
    expect(order.customer_id).toEqual(customerId);
    expect(order.seller_id).toEqual(sellerId);
    expect(parseFloat(order.total_value)).toEqual(157.50);
    expect(order.status).toEqual('pending_confirmation');
  });

  it('should handle order with null customer notes', async () => {
    await setupTestData();
    const input = createValidOrderInput();
    input.customer_notes = null;

    const result = await createOrder(input);

    expect(result.customer_notes).toBeNull();
  });

  it('should throw error for non-existent customer', async () => {
    await setupTestData();
    const input = createValidOrderInput();
    input.customer_id = 99999;

    await expect(createOrder(input)).rejects.toThrow(/customer not found/i);
  });

  it('should throw error for non-existent seller', async () => {
    await setupTestData();
    const input = createValidOrderInput();
    input.seller_id = 99999;

    await expect(createOrder(input)).rejects.toThrow(/seller not found/i);
  });

  it('should throw error for invalid customer role', async () => {
    await setupTestData();
    
    // Create a user with seller role
    const wrongRoleResult = await db.insert(usersTable)
      .values({
        email: 'wrong@test.com',
        full_name: 'Wrong Role',
        phone: '+84123456789',
        address: 'Test Address',
        role: 'seller' // Wrong role for customer
      })
      .returning()
      .execute();

    const input = createValidOrderInput();
    input.customer_id = wrongRoleResult[0].id;

    await expect(createOrder(input)).rejects.toThrow(/customer not found or invalid role/i);
  });

  it('should throw error for product not belonging to seller', async () => {
    await setupTestData();

    // Create another seller and product
    const anotherSellerResult = await db.insert(usersTable)
      .values({
        email: 'seller2@test.com',
        full_name: 'Another Seller',
        phone: '+84111222333',
        address: '999 Another Street',
        role: 'seller'
      })
      .returning()
      .execute();

    const anotherProductResult = await db.insert(productsTable)
      .values({
        name: 'Another Product',
        description: 'Product from different seller',
        price: '10.00',
        category: 'vegetables',
        origin: 'Ho Chi Minh City',
        stock_quantity: 20,
        unit_of_measurement: 'piece',
        images: [],
        seller_id: anotherSellerResult[0].id
      })
      .returning()
      .execute();

    const input = createValidOrderInput();
    input.items = [{
      product_id: anotherProductResult[0].id, // Product from different seller
      quantity: 1,
      unit_price: 10.00
    }];

    await expect(createOrder(input)).rejects.toThrow(/not found or does not belong to seller/i);
  });

  it('should throw error for insufficient stock', async () => {
    await setupTestData();
    const input = createValidOrderInput();
    input.items = [{
      product_id: productId1,
      quantity: 200, // More than available stock (100)
      unit_price: 25.50
    }];

    await expect(createOrder(input)).rejects.toThrow(/insufficient stock/i);
  });

  it('should throw error for price mismatch', async () => {
    await setupTestData();
    const input = createValidOrderInput();
    input.items = [{
      product_id: productId1,
      quantity: 5,
      unit_price: 30.00 // Different from actual price (25.50)
    }];

    await expect(createOrder(input)).rejects.toThrow(/price mismatch/i);
  });

  it('should rollback transaction on failure', async () => {
    await setupTestData();
    const input = createValidOrderInput();
    
    // Add an item with insufficient stock to cause failure
    input.items.push({
      product_id: productId1,
      quantity: 200, // This will cause failure
      unit_price: 25.50
    });

    // Get initial stock quantities
    const initialProduct1 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId1))
      .execute();
    const initialStock1 = initialProduct1[0].stock_quantity;

    const initialProduct2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId2))
      .execute();
    const initialStock2 = initialProduct2[0].stock_quantity;

    // Attempt to create order (should fail)
    await expect(createOrder(input)).rejects.toThrow();

    // Verify no changes were made to database
    const finalProduct1 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId1))
      .execute();
    expect(finalProduct1[0].stock_quantity).toEqual(initialStock1);

    const finalProduct2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId2))
      .execute();
    expect(finalProduct2[0].stock_quantity).toEqual(initialStock2);

    // Verify no order was created
    const orders = await db.select().from(ordersTable).execute();
    expect(orders).toHaveLength(0);

    // Verify no order items were created
    const orderItems = await db.select().from(orderItemsTable).execute();
    expect(orderItems).toHaveLength(0);
  });

  it('should handle single item order', async () => {
    await setupTestData();
    const input: CreateOrderInput = {
      customer_id: customerId,
      seller_id: sellerId,
      payment_method: 'bank_transfer',
      delivery_address: 'Single Item Delivery Address',
      customer_notes: null,
      items: [
        {
          product_id: productId1,
          quantity: 3,
          unit_price: 25.50
        }
      ]
    };

    const result = await createOrder(input);

    expect(result.total_value).toEqual(76.50); // 3 * 25.50
    expect(result.payment_method).toEqual('bank_transfer');

    // Verify stock update
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId1))
      .execute();
    expect(product[0].stock_quantity).toEqual(97); // 100 - 3
  });
});