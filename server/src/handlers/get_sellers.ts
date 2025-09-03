import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function getSellers(): Promise<User[]> {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.role, 'seller'))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch sellers:', error);
    throw error;
  }
}