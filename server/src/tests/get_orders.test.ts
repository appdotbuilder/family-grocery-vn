import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ordersTable, productsTable, orderItemsTable } from '../db/schema';
import { type GetOrdersInput } from '../schema';
import { getOrders } from '../handlers/get_orders';

// Test data setup
const testCustomer = {
  email: 'customer@test.com',
  full_name: 'Test Customer',
  phone: '0123456789',
  address: '123 Test Street',
  role: 'customer' as const
};

const testSeller = {
  email: 'seller@test.com',
  full_name: 'Test Seller',
  phone: '0987654321',
  address: '456 Seller Street',
  role: 'seller' as const
};

const testProduct = {
  name: 'Test Product',
  description: 'A product for testing',
  price: '25.50',
  category: 'vegetables' as const,
  origin: 'Đồng Tháp',
  stock_quantity: 100,
  unit_of_measurement: 'kg' as const,
  images: ['image1.jpg']
};

describe('getOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty result when no orders exist', async () => {
    const result = await getOrders();

    expect(result.orders).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should return all orders with correct format', async () => {
    // Create prerequisite data
    const customers = await db.insert(usersTable)
      .values([testCustomer])
      .returning()
      .execute();

    const sellers = await db.insert(usersTable)
      .values([testSeller])
      .returning()
      .execute();

    const customerId = customers[0].id;
    const sellerId = sellers[0].id;

    // Create test orders
    const testOrders = [
      {
        customer_id: customerId,
        seller_id: sellerId,
        total_value: '150.75',
        status: 'pending_confirmation' as const,
        payment_method: 'cod' as const,
        delivery_address: '789 Delivery Street',
        customer_notes: 'Please call before delivery'
      },
      {
        customer_id: customerId,
        seller_id: sellerId,
        total_value: '89.50',
        status: 'confirmed' as const,
        payment_method: 'bank_transfer' as const,
        delivery_address: '321 Another Street',
        customer_notes: null
      }
    ];

    await db.insert(ordersTable)
      .values(testOrders)
      .execute();

    const result = await getOrders();

    expect(result.orders).toHaveLength(2);
    expect(result.total).toBe(2);

    // Verify numeric conversion and field types
    expect(typeof result.orders[0].total_value).toBe('number');
    expect(result.orders[0].total_value).toBe(150.75);
    expect(result.orders[0].id).toBeDefined();
    expect(result.orders[0].created_at).toBeInstanceOf(Date);
    expect(result.orders[0].updated_at).toBeInstanceOf(Date);
    expect(result.orders[0].customer_id).toBe(customerId);
    expect(result.orders[0].seller_id).toBe(sellerId);
  });

  it('should filter orders by customer_id', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        testCustomer,
        { ...testCustomer, email: 'customer2@test.com' },
        testSeller
      ])
      .returning()
      .execute();

    const customer1Id = users[0].id;
    const customer2Id = users[1].id;
    const sellerId = users[2].id;

    // Create orders for different customers
    await db.insert(ordersTable)
      .values([
        {
          customer_id: customer1Id,
          seller_id: sellerId,
          total_value: '100.00',
          status: 'pending_confirmation' as const,
          payment_method: 'cod' as const,
          delivery_address: 'Address 1',
          customer_notes: null
        },
        {
          customer_id: customer2Id,
          seller_id: sellerId,
          total_value: '200.00',
          status: 'confirmed' as const,
          payment_method: 'momo' as const,
          delivery_address: 'Address 2',
          customer_notes: null
        }
      ])
      .execute();

    const input: GetOrdersInput = {
      customer_id: customer1Id,
      page: 1,
      limit: 10
    };

    const result = await getOrders(input);

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.orders[0].customer_id).toBe(customer1Id);
    expect(result.orders[0].total_value).toBe(100.00);
  });

  it('should filter orders by seller_id', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        testCustomer,
        testSeller,
        { ...testSeller, email: 'seller2@test.com' }
      ])
      .returning()
      .execute();

    const customerId = users[0].id;
    const seller1Id = users[1].id;
    const seller2Id = users[2].id;

    // Create orders for different sellers
    await db.insert(ordersTable)
      .values([
        {
          customer_id: customerId,
          seller_id: seller1Id,
          total_value: '75.25',
          status: 'delivering' as const,
          payment_method: 'zalopay' as const,
          delivery_address: 'Seller 1 Order',
          customer_notes: null
        },
        {
          customer_id: customerId,
          seller_id: seller2Id,
          total_value: '125.75',
          status: 'delivered' as const,
          payment_method: 'bank_transfer' as const,
          delivery_address: 'Seller 2 Order',
          customer_notes: null
        }
      ])
      .execute();

    const input: GetOrdersInput = {
      seller_id: seller2Id,
      page: 1,
      limit: 10
    };

    const result = await getOrders(input);

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.orders[0].seller_id).toBe(seller2Id);
    expect(result.orders[0].status).toBe('delivered');
  });

  it('should filter orders by status', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable)
      .values([testCustomer, testSeller])
      .returning()
      .execute();

    const customerId = users[0].id;
    const sellerId = users[1].id;

    // Create orders with different statuses
    await db.insert(ordersTable)
      .values([
        {
          customer_id: customerId,
          seller_id: sellerId,
          total_value: '50.00',
          status: 'pending_confirmation' as const,
          payment_method: 'cod' as const,
          delivery_address: 'Pending Order',
          customer_notes: null
        },
        {
          customer_id: customerId,
          seller_id: sellerId,
          total_value: '75.00',
          status: 'confirmed' as const,
          payment_method: 'momo' as const,
          delivery_address: 'Confirmed Order',
          customer_notes: null
        },
        {
          customer_id: customerId,
          seller_id: sellerId,
          total_value: '100.00',
          status: 'confirmed' as const,
          payment_method: 'bank_transfer' as const,
          delivery_address: 'Another Confirmed Order',
          customer_notes: null
        }
      ])
      .execute();

    const input: GetOrdersInput = {
      status: 'confirmed',
      page: 1,
      limit: 10
    };

    const result = await getOrders(input);

    expect(result.orders).toHaveLength(2);
    expect(result.total).toBe(2);
    result.orders.forEach(order => {
      expect(order.status).toBe('confirmed');
    });
  });

  it('should apply multiple filters correctly', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        testCustomer,
        { ...testCustomer, email: 'customer2@test.com' },
        testSeller
      ])
      .returning()
      .execute();

    const customer1Id = users[0].id;
    const customer2Id = users[1].id;
    const sellerId = users[2].id;

    // Create orders with various combinations
    await db.insert(ordersTable)
      .values([
        {
          customer_id: customer1Id,
          seller_id: sellerId,
          total_value: '60.00',
          status: 'confirmed' as const,
          payment_method: 'cod' as const,
          delivery_address: 'Match',
          customer_notes: null
        },
        {
          customer_id: customer1Id,
          seller_id: sellerId,
          total_value: '80.00',
          status: 'pending_confirmation' as const,
          payment_method: 'momo' as const,
          delivery_address: 'No Match - Different Status',
          customer_notes: null
        },
        {
          customer_id: customer2Id,
          seller_id: sellerId,
          total_value: '90.00',
          status: 'confirmed' as const,
          payment_method: 'zalopay' as const,
          delivery_address: 'No Match - Different Customer',
          customer_notes: null
        }
      ])
      .execute();

    const input: GetOrdersInput = {
      customer_id: customer1Id,
      status: 'confirmed',
      page: 1,
      limit: 10
    };

    const result = await getOrders(input);

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.orders[0].customer_id).toBe(customer1Id);
    expect(result.orders[0].status).toBe('confirmed');
    expect(result.orders[0].total_value).toBe(60.00);
  });

  it('should handle pagination correctly', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable)
      .values([testCustomer, testSeller])
      .returning()
      .execute();

    const customerId = users[0].id;
    const sellerId = users[1].id;

    // Create multiple orders
    const orderPromises = [];
    for (let i = 1; i <= 15; i++) {
      orderPromises.push({
        customer_id: customerId,
        seller_id: sellerId,
        total_value: `${i * 10}.00`,
        status: 'pending_confirmation' as const,
        payment_method: 'cod' as const,
        delivery_address: `Address ${i}`,
        customer_notes: null
      });
    }

    await db.insert(ordersTable)
      .values(orderPromises)
      .execute();

    // Test first page
    const firstPage = await getOrders({ page: 1, limit: 5 });
    expect(firstPage.orders).toHaveLength(5);
    expect(firstPage.total).toBe(15);

    // Test second page
    const secondPage = await getOrders({ page: 2, limit: 5 });
    expect(secondPage.orders).toHaveLength(5);
    expect(secondPage.total).toBe(15);

    // Test third page
    const thirdPage = await getOrders({ page: 3, limit: 5 });
    expect(thirdPage.orders).toHaveLength(5);
    expect(thirdPage.total).toBe(15);

    // Test page beyond available data
    const fourthPage = await getOrders({ page: 4, limit: 5 });
    expect(fourthPage.orders).toHaveLength(0);
    expect(fourthPage.total).toBe(15);
  });

  it('should use default pagination values when not specified', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable)
      .values([testCustomer, testSeller])
      .returning()
      .execute();

    const customerId = users[0].id;
    const sellerId = users[1].id;

    // Create 15 orders
    const orderPromises = [];
    for (let i = 1; i <= 15; i++) {
      orderPromises.push({
        customer_id: customerId,
        seller_id: sellerId,
        total_value: `${i}.00`,
        status: 'pending_confirmation' as const,
        payment_method: 'cod' as const,
        delivery_address: `Address ${i}`,
        customer_notes: null
      });
    }

    await db.insert(ordersTable)
      .values(orderPromises)
      .execute();

    // Test without pagination parameters (should use defaults: page=1, limit=10)
    const result = await getOrders({ page: 1, limit: 10 });
    expect(result.orders).toHaveLength(10); // Default limit
    expect(result.total).toBe(15);
  });

  it('should handle empty result set with filters', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable)
      .values([testCustomer, testSeller])
      .returning()
      .execute();

    const customerId = users[0].id;
    const sellerId = users[1].id;

    // Create order with different status
    await db.insert(ordersTable)
      .values([{
        customer_id: customerId,
        seller_id: sellerId,
        total_value: '50.00',
        status: 'delivered' as const,
        payment_method: 'cod' as const,
        delivery_address: 'Test Address',
        customer_notes: null
      }])
      .execute();

    // Filter by non-matching status
    const result = await getOrders({ 
      status: 'cancelled',
      page: 1,
      limit: 10
    });

    expect(result.orders).toEqual([]);
    expect(result.total).toBe(0);
  });
});