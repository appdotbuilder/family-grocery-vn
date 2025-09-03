import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { createProduct } from '../handlers/create_product';
import { eq } from 'drizzle-orm';

// Test seller user
const testSeller = {
  email: 'seller@test.com',
  full_name: 'Test Seller',
  phone: '0123456789',
  address: '123 Test Street',
  role: 'seller' as const
};

// Test customer user (for negative test cases)
const testCustomer = {
  email: 'customer@test.com',
  full_name: 'Test Customer',
  phone: '0987654321',
  address: '456 Customer Street',
  role: 'customer' as const
};

// Complete test product input
const testProductInput: CreateProductInput = {
  name: 'Thịt bò Úc',
  description: 'Thịt bò nhập khẩu từ Úc, chất lượng cao',
  price: 299000,
  category: 'meat',
  origin: 'Úc',
  stock_quantity: 50,
  unit_of_measurement: 'kg',
  images: ['https://example.com/beef1.jpg', 'https://example.com/beef2.jpg'],
  seller_id: 1 // Will be updated after creating seller
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let sellerId: number;
  let customerId: number;

  beforeEach(async () => {
    // Create test seller
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    sellerId = sellerResult[0].id;

    // Create test customer
    const customerResult = await db.insert(usersTable)
      .values(testCustomer)
      .returning()
      .execute();
    customerId = customerResult[0].id;

    // Update test input with actual seller ID
    testProductInput.seller_id = sellerId;
  });

  it('should create a product successfully', async () => {
    const result = await createProduct(testProductInput);

    // Verify all fields are correctly set
    expect(result.name).toEqual('Thịt bò Úc');
    expect(result.description).toEqual(testProductInput.description);
    expect(result.price).toEqual(299000);
    expect(typeof result.price).toEqual('number'); // Verify numeric conversion
    expect(result.category).toEqual('meat');
    expect(result.origin).toEqual('Úc');
    expect(result.stock_quantity).toEqual(50);
    expect(result.unit_of_measurement).toEqual('kg');
    expect(result.images).toEqual(['https://example.com/beef1.jpg', 'https://example.com/beef2.jpg']);
    expect(result.seller_id).toEqual(sellerId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save product to database correctly', async () => {
    const result = await createProduct(testProductInput);

    // Query database to verify product was saved
    const savedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(savedProducts).toHaveLength(1);
    const savedProduct = savedProducts[0];
    
    expect(savedProduct.name).toEqual('Thịt bò Úc');
    expect(savedProduct.description).toEqual(testProductInput.description);
    expect(parseFloat(savedProduct.price)).toEqual(299000); // Verify numeric field storage
    expect(savedProduct.category).toEqual('meat');
    expect(savedProduct.origin).toEqual('Úc');
    expect(savedProduct.stock_quantity).toEqual(50);
    expect(savedProduct.unit_of_measurement).toEqual('kg');
    expect(savedProduct.images).toEqual(['https://example.com/beef1.jpg', 'https://example.com/beef2.jpg']);
    expect(savedProduct.seller_id).toEqual(sellerId);
    expect(savedProduct.created_at).toBeInstanceOf(Date);
    expect(savedProduct.updated_at).toBeInstanceOf(Date);
  });

  it('should create product with empty images array when not provided', async () => {
    const inputWithoutImages = {
      ...testProductInput,
      images: [] // Test with empty array (default value)
    };

    const result = await createProduct(inputWithoutImages);

    expect(result.images).toEqual([]);
  });

  it('should create product with different categories and units', async () => {
    const seafoodInput: CreateProductInput = {
      name: 'Tôm sú',
      description: 'Tôm sú tươi sống',
      price: 450000,
      category: 'seafood',
      origin: 'Cà Mau',
      stock_quantity: 20,
      unit_of_measurement: 'kg',
      images: [],
      seller_id: sellerId
    };

    const result = await createProduct(seafoodInput);

    expect(result.category).toEqual('seafood');
    expect(result.origin).toEqual('Cà Mau');
    expect(result.unit_of_measurement).toEqual('kg');
    expect(result.price).toEqual(450000);
  });

  it('should throw error when seller_id does not exist', async () => {
    const invalidInput = {
      ...testProductInput,
      seller_id: 99999 // Non-existent ID
    };

    await expect(createProduct(invalidInput)).rejects.toThrow(/seller not found/i);
  });

  it('should throw error when user is not a seller', async () => {
    const invalidInput = {
      ...testProductInput,
      seller_id: customerId // Customer ID instead of seller ID
    };

    await expect(createProduct(invalidInput)).rejects.toThrow(/user is not a seller/i);
  });

  it('should handle various product categories correctly', async () => {
    const categories = ['vegetables', 'fruits', 'beverages'] as const;
    
    for (const category of categories) {
      const categoryInput: CreateProductInput = {
        name: `Test ${category}`,
        description: `Test ${category} product`,
        price: 100000,
        category: category,
        origin: 'Việt Nam',
        stock_quantity: 10,
        unit_of_measurement: 'kg',
        images: [],
        seller_id: sellerId
      };

      const result = await createProduct(categoryInput);
      expect(result.category).toEqual(category);
    }
  });

  it('should handle various units of measurement correctly', async () => {
    const units = ['piece', 'dozen', 'liter', 'bottle'] as const;
    
    for (const unit of units) {
      const unitInput: CreateProductInput = {
        name: `Test product ${unit}`,
        description: `Test product with ${unit} unit`,
        price: 50000,
        category: 'others',
        origin: 'Việt Nam',
        stock_quantity: 25,
        unit_of_measurement: unit,
        images: [],
        seller_id: sellerId
      };

      const result = await createProduct(unitInput);
      expect(result.unit_of_measurement).toEqual(unit);
    }
  });
});