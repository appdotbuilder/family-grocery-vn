import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateProductInput, type Product } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function updateProduct(input: UpdateProductInput): Promise<Product | null> {
  try {
    const { id, ...updateFields } = input;

    // First, check if the product exists and get current data
    const existingProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (existingProducts.length === 0) {
      return null; // Product not found
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    // Convert numeric fields to strings for database storage
    if (updateFields.price !== undefined) {
      updateData.price = updateFields.price.toString();
    }

    // Add other fields if provided
    if (updateFields.name !== undefined) {
      updateData.name = updateFields.name;
    }
    if (updateFields.description !== undefined) {
      updateData.description = updateFields.description;
    }
    if (updateFields.category !== undefined) {
      updateData.category = updateFields.category;
    }
    if (updateFields.origin !== undefined) {
      updateData.origin = updateFields.origin;
    }
    if (updateFields.stock_quantity !== undefined) {
      updateData.stock_quantity = updateFields.stock_quantity;
    }
    if (updateFields.unit_of_measurement !== undefined) {
      updateData.unit_of_measurement = updateFields.unit_of_measurement;
    }
    if (updateFields.images !== undefined) {
      updateData.images = updateFields.images;
    }

    // Update the product
    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const updatedProduct = result[0];
    return {
      ...updatedProduct,
      price: parseFloat(updatedProduct.price)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
}