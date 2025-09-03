import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type CreateProductInput, type Product } from '../schema';
import { eq } from 'drizzle-orm';

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    // First, verify that the seller_id corresponds to a user with role 'seller'
    const seller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.seller_id))
      .execute();

    if (seller.length === 0) {
      throw new Error('Seller not found');
    }

    if (seller[0].role !== 'seller') {
      throw new Error('User is not a seller');
    }

    // Insert the product into the database
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        price: input.price.toString(), // Convert number to string for numeric column
        category: input.category,
        origin: input.origin,
        stock_quantity: input.stock_quantity, // Integer column - no conversion needed
        unit_of_measurement: input.unit_of_measurement,
        images: input.images, // JSON array - use as is
        seller_id: input.seller_id
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}