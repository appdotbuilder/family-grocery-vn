import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type GetProductsInput } from '../schema';
import { getProducts } from '../handlers/get_products';

// Test data setup
const testSeller = {
  email: 'seller@test.com',
  full_name: 'Test Seller',
  phone: '0987654321',
  address: 'Test Address',
  role: 'seller' as const
};

const testSeller2 = {
  email: 'seller2@test.com',
  full_name: 'Test Seller 2',
  phone: '0987654322',
  address: 'Test Address 2',
  role: 'seller' as const
};

const testProducts = [
  {
    name: 'Fresh Beef',
    description: 'High quality beef from local farm',
    price: '25.50',
    category: 'meat' as const,
    origin: 'Đồng Tháp',
    stock_quantity: 100,
    unit_of_measurement: 'kg' as const,
    images: ['beef1.jpg', 'beef2.jpg']
  },
  {
    name: 'Organic Chicken',
    description: 'Free range organic chicken',
    price: '15.75',
    category: 'poultry' as const,
    origin: 'Long An',
    stock_quantity: 50,
    unit_of_measurement: 'kg' as const,
    images: ['chicken1.jpg']
  },
  {
    name: 'Fresh Tomatoes',
    description: 'Ripe red tomatoes',
    price: '5.25',
    category: 'vegetables' as const,
    origin: 'Đà Lạt',
    stock_quantity: 200,
    unit_of_measurement: 'kg' as const,
    images: []
  },
  {
    name: 'Premium Salmon',
    description: 'Fresh Atlantic salmon',
    price: '45.00',
    category: 'seafood' as const,
    origin: 'Nha Trang',
    stock_quantity: 25,
    unit_of_measurement: 'kg' as const,
    images: ['salmon1.jpg']
  }
];

describe('getProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all products when no filters provided', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const result = await getProducts();

    expect(result.products).toHaveLength(4);
    expect(result.total).toBe(4);
    
    // Check numeric conversion
    result.products.forEach(product => {
      expect(typeof product.price).toBe('number');
      expect(product.price).toBeGreaterThan(0);
    });

    // Check that products are properly ordered by created_at descending
    for (let i = 0; i < result.products.length - 1; i++) {
      expect(result.products[i].created_at.getTime()).toBeGreaterThanOrEqual(
        result.products[i + 1].created_at.getTime()
      );
    }
  });

  it('should filter products by category', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const input: GetProductsInput = {
      category: 'meat',
      page: 1,
      limit: 20
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.products[0].name).toBe('Fresh Beef');
    expect(result.products[0].category).toBe('meat');
  });

  it('should filter products by seller_id', async () => {
    // Create two sellers
    const [seller1] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    const [seller2] = await db.insert(usersTable)
      .values(testSeller2)
      .returning()
      .execute();

    // Create products for seller1
    await db.insert(productsTable)
      .values([
        { ...testProducts[0], seller_id: seller1.id },
        { ...testProducts[1], seller_id: seller1.id }
      ])
      .execute();

    // Create products for seller2
    await db.insert(productsTable)
      .values([
        { ...testProducts[2], seller_id: seller2.id },
        { ...testProducts[3], seller_id: seller2.id }
      ])
      .execute();

    const input: GetProductsInput = {
      seller_id: seller1.id,
      page: 1,
      limit: 20
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(2);
    result.products.forEach(product => {
      expect(product.seller_id).toBe(seller1.id);
    });
  });

  it('should filter products by price range', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const input: GetProductsInput = {
      min_price: 10,
      max_price: 30,
      page: 1,
      limit: 20
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(2);
    
    result.products.forEach(product => {
      expect(product.price).toBeGreaterThanOrEqual(10);
      expect(product.price).toBeLessThanOrEqual(30);
    });

    // Should include Fresh Beef (25.50) and Organic Chicken (15.75)
    const productNames = result.products.map(p => p.name).sort();
    expect(productNames).toEqual(['Fresh Beef', 'Organic Chicken']);
  });

  it('should search products by name and description', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const input: GetProductsInput = {
      search: 'fresh',
      page: 1,
      limit: 20
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(3);
    expect(result.total).toBe(3);

    // Should find products with 'fresh' in name or description
    const productNames = result.products.map(p => p.name).sort();
    expect(productNames).toEqual(['Fresh Beef', 'Fresh Tomatoes', 'Premium Salmon']);
  });

  it('should handle pagination correctly', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    // Test first page with limit 2
    const input1: GetProductsInput = {
      page: 1,
      limit: 2
    };

    const result1 = await getProducts(input1);

    expect(result1.products).toHaveLength(2);
    expect(result1.total).toBe(4);

    // Test second page with limit 2
    const input2: GetProductsInput = {
      page: 2,
      limit: 2
    };

    const result2 = await getProducts(input2);

    expect(result2.products).toHaveLength(2);
    expect(result2.total).toBe(4);

    // Products should be different between pages
    const page1Ids = result1.products.map(p => p.id);
    const page2Ids = result2.products.map(p => p.id);
    expect(page1Ids).not.toEqual(page2Ids);
  });

  it('should combine multiple filters', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const input: GetProductsInput = {
      category: 'meat',
      min_price: 20,
      search: 'beef',
      seller_id: seller.id,
      page: 1,
      limit: 20
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.products[0].name).toBe('Fresh Beef');
    expect(result.products[0].category).toBe('meat');
    expect(result.products[0].price).toBeGreaterThanOrEqual(20);
    expect(result.products[0].seller_id).toBe(seller.id);
  });

  it('should return empty results when no products match filters', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const input: GetProductsInput = {
      category: 'meat',
      min_price: 100, // No products with price >= 100
      page: 1,
      limit: 20
    };

    const result = await getProducts(input);

    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should use default pagination values', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    // Call without pagination parameters (will use defaults)
    const result = await getProducts();

    expect(result.products).toHaveLength(4); // All products fit in default limit of 20
    expect(result.total).toBe(4);
  });

  it('should handle images field correctly', async () => {
    // Create seller
    const [seller] = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    // Create products
    await db.insert(productsTable)
      .values(testProducts.map(product => ({
        ...product,
        seller_id: seller.id
      })))
      .execute();

    const result = await getProducts();

    // Check images field is properly handled
    const beefProduct = result.products.find(p => p.name === 'Fresh Beef');
    expect(beefProduct?.images).toEqual(['beef1.jpg', 'beef2.jpg']);

    const tomatoProduct = result.products.find(p => p.name === 'Fresh Tomatoes');
    expect(tomatoProduct?.images).toEqual([]);
  });
});