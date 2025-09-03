import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type UpdateProductInput, type CreateUserInput } from '../schema';
import { updateProduct } from '../handlers/update_product';
import { eq } from 'drizzle-orm';

// Create test user first (seller)
const testSeller: CreateUserInput = {
  email: 'seller@test.com',
  full_name: 'Test Seller',
  phone: '0901234567',
  address: 'Ho Chi Minh City',
  role: 'seller'
};

// Create test product data
const createTestProduct = async (sellerId: number) => {
  const result = await db.insert(productsTable)
    .values({
      name: 'Original Product',
      description: 'Original description',
      price: '29.99',
      category: 'vegetables',
      origin: 'Da Lat',
      stock_quantity: 50,
      unit_of_measurement: 'kg',
      images: ['image1.jpg'],
      seller_id: sellerId
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('updateProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all fields of a product', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      name: 'Updated Product Name',
      description: 'Updated description',
      price: 39.99,
      category: 'fruits',
      origin: 'Can Tho',
      stock_quantity: 75,
      unit_of_measurement: 'piece',
      images: ['new_image1.jpg', 'new_image2.jpg']
    };

    const result = await updateProduct(updateInput);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual('Updated Product Name');
    expect(result!.description).toEqual('Updated description');
    expect(result!.price).toEqual(39.99);
    expect(typeof result!.price).toEqual('number');
    expect(result!.category).toEqual('fruits');
    expect(result!.origin).toEqual('Can Tho');
    expect(result!.stock_quantity).toEqual(75);
    expect(result!.unit_of_measurement).toEqual('piece');
    expect(result!.images).toEqual(['new_image1.jpg', 'new_image2.jpg']);
    expect(result!.seller_id).toEqual(seller[0].id);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.updated_at > product.created_at).toBe(true);
  });

  it('should update only specified fields', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      name: 'New Name Only',
      price: 45.50
    };

    const result = await updateProduct(updateInput);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual('New Name Only');
    expect(result!.price).toEqual(45.50);
    expect(typeof result!.price).toEqual('number');
    // Other fields should remain unchanged
    expect(result!.description).toEqual('Original description');
    expect(result!.category).toEqual('vegetables');
    expect(result!.origin).toEqual('Da Lat');
    expect(result!.stock_quantity).toEqual(50);
    expect(result!.unit_of_measurement).toEqual('kg');
  });

  it('should update product in database', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      name: 'Database Updated Name',
      stock_quantity: 100
    };

    await updateProduct(updateInput);

    // Verify database was updated
    const updatedInDb = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product.id))
      .execute();

    expect(updatedInDb).toHaveLength(1);
    expect(updatedInDb[0].name).toEqual('Database Updated Name');
    expect(updatedInDb[0].stock_quantity).toEqual(100);
    expect(parseFloat(updatedInDb[0].price)).toEqual(29.99); // Original price unchanged
    expect(updatedInDb[0].updated_at).toBeInstanceOf(Date);
    expect(updatedInDb[0].updated_at > updatedInDb[0].created_at).toBe(true);
  });

  it('should return null for non-existent product', async () => {
    const updateInput: UpdateProductInput = {
      id: 999999, // Non-existent ID
      name: 'This will not work'
    };

    const result = await updateProduct(updateInput);

    expect(result).toBeNull();
  });

  it('should handle price conversion correctly', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      price: 123.456789 // Test precision
    };

    const result = await updateProduct(updateInput);

    expect(result).not.toBeNull();
    expect(typeof result!.price).toEqual('number');
    expect(result!.price).toBeCloseTo(123.46, 2); // Should be rounded to 2 decimal places

    // Verify in database
    const dbProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product.id))
      .execute();

    expect(parseFloat(dbProduct[0].price)).toBeCloseTo(123.46, 2);
  });

  it('should handle empty images array', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      images: []
    };

    const result = await updateProduct(updateInput);

    expect(result).not.toBeNull();
    expect(result!.images).toEqual([]);
  });

  it('should preserve unchanged fields when updating', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);
    const originalCreatedAt = product.created_at;

    const updateInput: UpdateProductInput = {
      id: product.id,
      description: 'Only description changed'
    };

    const result = await updateProduct(updateInput);

    expect(result).not.toBeNull();
    expect(result!.description).toEqual('Only description changed');
    expect(result!.name).toEqual('Original Product'); // Unchanged
    expect(result!.price).toEqual(29.99); // Unchanged
    expect(result!.created_at).toEqual(originalCreatedAt); // Should be preserved
    expect(result!.seller_id).toEqual(seller[0].id); // Unchanged
  });

  it('should update stock quantity to zero', async () => {
    // Create seller
    const seller = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    // Create product
    const product = await createTestProduct(seller[0].id);

    const updateInput: UpdateProductInput = {
      id: product.id,
      stock_quantity: 0 // Should allow zero stock
    };

    const result = await updateProduct(updateInput);

    expect(result).not.toBeNull();
    expect(result!.stock_quantity).toEqual(0);
  });
});