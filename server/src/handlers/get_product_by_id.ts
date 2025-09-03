import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type Product } from '../schema';
import { eq } from 'drizzle-orm';

export async function getProductById(id: number): Promise<Product | null> {
  try {
    // Query product with seller information through join
    const result = await db.select()
      .from(productsTable)
      .innerJoin(usersTable, eq(productsTable.seller_id, usersTable.id))
      .where(eq(productsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Extract product data from joined result
    const productData = result[0].products;

    // Convert numeric fields back to numbers and return
    return {
      ...productData,
      price: parseFloat(productData.price)
    };
  } catch (error) {
    console.error('Failed to fetch product by ID:', error);
    throw error;
  }
}