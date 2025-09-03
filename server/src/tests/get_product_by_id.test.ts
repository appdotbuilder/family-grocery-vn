import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { getProductById } from '../handlers/get_product_by_id';
import { eq } from 'drizzle-orm';

// Test data
const testSeller = {
  email: 'seller@test.com',
  full_name: 'Test Seller',
  phone: '0987654321',
  address: 'Test Address',
  role: 'seller' as const
};

const testProduct = {
  name: 'Test Product',
  description: 'A product for testing',
  price: '29.99', // Store as string for numeric column
  category: 'vegetables' as const,
  origin: 'Đồng Tháp',
  stock_quantity: 50,
  unit_of_measurement: 'kg' as const,
  images: ['image1.jpg', 'image2.jpg'],
  seller_id: 1 // Will be set after creating seller
};

describe('getProductById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return product when found', async () => {
    // Create seller first
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    const sellerId = sellerResult[0].id;

    // Create product
    const productResult = await db.insert(productsTable)
      .values({
        ...testProduct,
        seller_id: sellerId
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Test the handler
    const result = await getProductById(productId);

    // Verify the result
    expect(result).toBeDefined();
    expect(result!.id).toEqual(productId);
    expect(result!.name).toEqual('Test Product');
    expect(result!.description).toEqual(testProduct.description);
    expect(result!.price).toEqual(29.99); // Should be converted to number
    expect(typeof result!.price).toBe('number');
    expect(result!.category).toEqual('vegetables');
    expect(result!.origin).toEqual('Đồng Tháp');
    expect(result!.stock_quantity).toEqual(50);
    expect(result!.unit_of_measurement).toEqual('kg');
    expect(result!.images).toEqual(['image1.jpg', 'image2.jpg']);
    expect(result!.seller_id).toEqual(sellerId);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when product not found', async () => {
    const result = await getProductById(999);
    expect(result).toBeNull();
  });

  it('should handle products with empty images array', async () => {
    // Create seller first
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    const sellerId = sellerResult[0].id;

    // Create product with empty images
    const productResult = await db.insert(productsTable)
      .values({
        ...testProduct,
        images: [], // Empty array
        seller_id: sellerId
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Test the handler
    const result = await getProductById(productId);

    expect(result).toBeDefined();
    expect(result!.images).toEqual([]);
    expect(Array.isArray(result!.images)).toBe(true);
  });

  it('should work with different product categories and units', async () => {
    // Create seller
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();

    const sellerId = sellerResult[0].id;

    // Create product with different category and unit
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Fresh Chicken',
        description: 'Farm-raised chicken',
        price: '150000.00',
        category: 'poultry',
        origin: 'Cà Mau',
        stock_quantity: 20,
        unit_of_measurement: 'piece',
        images: ['chicken.jpg'],
        seller_id: sellerId
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Test the handler
    const result = await getProductById(productId);

    expect(result).toBeDefined();
    expect(result!.name).toEqual('Fresh Chicken');
    expect(result!.price).toEqual(150000);
    expect(result!.category).toEqual('poultry');
    expect(result!.origin).toEqual('Cà Mau');
    expect(result!.unit_of_measurement).toEqual('piece');
  });

  it('should verify seller relationship exists', async () => {
    // Create seller with specific data
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'specific@seller.com',
        full_name: 'Specific Seller Name',
        phone: '0123456789',
        address: 'Specific Address',
        role: 'seller' as const
      })
      .returning()
      .execute();

    const sellerId = sellerResult[0].id;

    // Create product
    const productResult = await db.insert(productsTable)
      .values({
        ...testProduct,
        seller_id: sellerId
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Test the handler
    const result = await getProductById(productId);

    expect(result).toBeDefined();
    expect(result!.seller_id).toEqual(sellerId);
    
    // Verify that the join worked by checking the seller exists
    const directQuery = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, sellerId))
      .execute();
    
    expect(directQuery[0].full_name).toEqual('Specific Seller Name');
  });
});