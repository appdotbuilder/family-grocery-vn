import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User } from '../schema';

export async function getUserById(id: number): Promise<User | null> {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const user = results[0];
    return {
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Failed to get user by id:', error);
    throw error;
  }
}