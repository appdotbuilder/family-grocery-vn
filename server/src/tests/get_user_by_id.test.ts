import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUserById } from '../handlers/get_user_by_id';
import { eq } from 'drizzle-orm';

// Test user inputs
const customerInput: CreateUserInput = {
  email: 'customer@test.com',
  full_name: 'John Customer',
  phone: '0901234567',
  address: '123 Main St, Ho Chi Minh City',
  role: 'customer'
};

const sellerInput: CreateUserInput = {
  email: 'seller@test.com',
  full_name: 'Jane Seller',
  phone: '0987654321',
  address: '456 Business Ave, Hanoi',
  role: 'seller'
};

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when found', async () => {
    // Create a test user
    const insertedUsers = await db.insert(usersTable)
      .values(customerInput)
      .returning()
      .execute();

    const insertedUser = insertedUsers[0];
    
    // Get user by ID
    const result = await getUserById(insertedUser.id);

    // Verify user is returned correctly
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(insertedUser.id);
    expect(result!.email).toEqual('customer@test.com');
    expect(result!.full_name).toEqual('John Customer');
    expect(result!.phone).toEqual('0901234567');
    expect(result!.address).toEqual('123 Main St, Ho Chi Minh City');
    expect(result!.role).toEqual('customer');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when user not found', async () => {
    // Try to get non-existent user
    const result = await getUserById(999);

    expect(result).toBeNull();
  });

  it('should work for both customer and seller roles', async () => {
    // Create both customer and seller
    const customerResult = await db.insert(usersTable)
      .values(customerInput)
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values(sellerInput)
      .returning()
      .execute();

    const customerId = customerResult[0].id;
    const sellerId = sellerResult[0].id;

    // Get customer by ID
    const customer = await getUserById(customerId);
    expect(customer).not.toBeNull();
    expect(customer!.role).toEqual('customer');
    expect(customer!.email).toEqual('customer@test.com');
    expect(customer!.full_name).toEqual('John Customer');

    // Get seller by ID
    const seller = await getUserById(sellerId);
    expect(seller).not.toBeNull();
    expect(seller!.role).toEqual('seller');
    expect(seller!.email).toEqual('seller@test.com');
    expect(seller!.full_name).toEqual('Jane Seller');
  });

  it('should handle user with null address', async () => {
    const userWithNullAddress: CreateUserInput = {
      email: 'noaddress@test.com',
      full_name: 'No Address User',
      phone: '0912345678',
      address: null,
      role: 'customer'
    };

    // Create user with null address
    const insertedUsers = await db.insert(usersTable)
      .values(userWithNullAddress)
      .returning()
      .execute();

    const insertedUser = insertedUsers[0];
    
    // Get user by ID
    const result = await getUserById(insertedUser.id);

    expect(result).not.toBeNull();
    expect(result!.address).toBeNull();
    expect(result!.email).toEqual('noaddress@test.com');
    expect(result!.full_name).toEqual('No Address User');
    expect(result!.role).toEqual('customer');
  });

  it('should verify user exists in database after retrieval', async () => {
    // Create a test user
    const insertedUsers = await db.insert(usersTable)
      .values(customerInput)
      .returning()
      .execute();

    const insertedUser = insertedUsers[0];
    
    // Get user using handler
    const handlerResult = await getUserById(insertedUser.id);

    // Verify the user actually exists in database
    const dbUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, insertedUser.id))
      .execute();

    expect(dbUsers).toHaveLength(1);
    expect(handlerResult!.id).toEqual(dbUsers[0].id);
    expect(handlerResult!.email).toEqual(dbUsers[0].email);
    expect(handlerResult!.full_name).toEqual(dbUsers[0].full_name);
    expect(handlerResult!.phone).toEqual(dbUsers[0].phone);
    expect(handlerResult!.address).toEqual(dbUsers[0].address);
    expect(handlerResult!.role).toEqual(dbUsers[0].role);
  });

  it('should handle different ID types correctly', async () => {
    // Create multiple users to test different IDs
    const user1 = await db.insert(usersTable)
      .values({
        ...customerInput,
        email: 'user1@test.com'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        ...sellerInput,
        email: 'user2@test.com'
      })
      .returning()
      .execute();

    // Get each user by their specific ID
    const result1 = await getUserById(user1[0].id);
    const result2 = await getUserById(user2[0].id);

    // Verify we get the correct users
    expect(result1!.email).toEqual('user1@test.com');
    expect(result1!.role).toEqual('customer');

    expect(result2!.email).toEqual('user2@test.com');
    expect(result2!.role).toEqual('seller');

    // Verify we don't get mixed results
    expect(result1!.id).not.toEqual(result2!.id);
    expect(result1!.email).not.toEqual(result2!.email);
  });
});