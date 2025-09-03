import { db } from '../db';
import { productsTable } from '../db/schema';
import { type GetProductsInput, type Product } from '../schema';
import { and, eq, gte, lte, ilike, or, count, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getProducts(input: GetProductsInput = { page: 1, limit: 20 }): Promise<{ products: Product[], total: number }> {
  try {
    // Use defaults from Zod schema
    const page = input.page || 1;
    const limit = input.limit || 20;
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (input.category) {
      conditions.push(eq(productsTable.category, input.category));
    }

    if (input.seller_id) {
      conditions.push(eq(productsTable.seller_id, input.seller_id));
    }

    if (input.min_price !== undefined) {
      conditions.push(gte(productsTable.price, input.min_price.toString()));
    }

    if (input.max_price !== undefined) {
      conditions.push(lte(productsTable.price, input.max_price.toString()));
    }

    if (input.search) {
      const searchTerm = `%${input.search}%`;
      conditions.push(
        or(
          ilike(productsTable.name, searchTerm),
          ilike(productsTable.description, searchTerm)
        )!
      );
    }

    // Execute main query directly without intermediate variables
    const mainQueryPromise = conditions.length > 0
      ? db.select()
          .from(productsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(productsTable.created_at))
          .limit(limit)
          .offset(offset)
          .execute()
      : db.select()
          .from(productsTable)
          .orderBy(desc(productsTable.created_at))
          .limit(limit)
          .offset(offset)
          .execute();

    // Execute count query directly without intermediate variables
    const countQueryPromise = conditions.length > 0
      ? db.select({ count: count() })
          .from(productsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : db.select({ count: count() })
          .from(productsTable)
          .execute();

    // Execute both queries
    const [results, totalResults] = await Promise.all([
      mainQueryPromise,
      countQueryPromise
    ]);

    // Convert numeric fields back to numbers
    const products: Product[] = results.map(product => ({
      ...product,
      price: parseFloat(product.price),
      images: product.images as string[] // Type assertion for jsonb field
    }));

    const total = totalResults[0].count;

    return {
      products,
      total
    };
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}