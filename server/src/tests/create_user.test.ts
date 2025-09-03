import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test inputs for different user types
const testCustomerInput: CreateUserInput = {
  email: 'customer@test.com',
  full_name: 'Nguyễn Văn An',
  phone: '+84901234567',
  address: '123 Đường ABC, Quận 1, TP.HCM',
  role: 'customer'
};

const testSellerInput: CreateUserInput = {
  email: 'seller@test.com',
  full_name: 'Trần Thị Bình',
  phone: '0912345678',
  address: 'Farm 456, Đồng Tháp',
  role: 'seller'
};

const testUserWithoutAddress: CreateUserInput = {
  email: 'noaddress@test.com',
  full_name: 'Lê Văn Cường',
  phone: '84987654321',
  address: null,
  role: 'customer'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a customer user', async () => {
    const result = await createUser(testCustomerInput);

    // Basic field validation
    expect(result.email).toEqual('customer@test.com');
    expect(result.full_name).toEqual('Nguyễn Văn An');
    expect(result.phone).toEqual('+84901234567');
    expect(result.address).toEqual('123 Đường ABC, Quận 1, TP.HCM');
    expect(result.role).toEqual('customer');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a seller user', async () => {
    const result = await createUser(testSellerInput);

    expect(result.email).toEqual('seller@test.com');
    expect(result.full_name).toEqual('Trần Thị Bình');
    expect(result.phone).toEqual('0912345678');
    expect(result.address).toEqual('Farm 456, Đồng Tháp');
    expect(result.role).toEqual('seller');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a user with null address', async () => {
    const result = await createUser(testUserWithoutAddress);

    expect(result.email).toEqual('noaddress@test.com');
    expect(result.full_name).toEqual('Lê Văn Cường');
    expect(result.phone).toEqual('84987654321');
    expect(result.address).toBeNull();
    expect(result.role).toEqual('customer');
    expect(result.id).toBeDefined();
  });

  it('should save user to database', async () => {
    const result = await createUser(testCustomerInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('customer@test.com');
    expect(users[0].full_name).toEqual('Nguyễn Văn An');
    expect(users[0].phone).toEqual('+84901234567');
    expect(users[0].address).toEqual('123 Đường ABC, Quận 1, TP.HCM');
    expect(users[0].role).toEqual('customer');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testCustomerInput);

    // Try to create another user with the same email
    const duplicateEmailInput: CreateUserInput = {
      ...testSellerInput,
      email: 'customer@test.com' // Same email as first user
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow(/duplicate key value/i);
  });

  it('should allow same phone number for different users', async () => {
    // Create first user
    await createUser(testCustomerInput);

    // Create second user with same phone (should be allowed)
    const samePhoneInput: CreateUserInput = {
      ...testSellerInput,
      phone: '+84901234567' // Same phone as first user
    };

    const result = await createUser(samePhoneInput);
    expect(result.id).toBeDefined();
    expect(result.phone).toEqual('+84901234567');
  });

  it('should handle various Vietnamese phone formats', async () => {
    const phoneFormats = [
      { input: '0901234567', expected: '0901234567' },
      { input: '+84901234567', expected: '+84901234567' },
      { input: '84901234567', expected: '84901234567' }
    ];

    for (let i = 0; i < phoneFormats.length; i++) {
      const format = phoneFormats[i];
      const testInput: CreateUserInput = {
        email: `test${i}@example.com`,
        full_name: `Test User ${i}`,
        phone: format.input,
        address: 'Test Address',
        role: 'customer'
      };

      const result = await createUser(testInput);
      expect(result.phone).toEqual(format.expected);
    }
  });

  it('should set timestamps correctly', async () => {
    const beforeCreation = new Date();
    const result = await createUser(testCustomerInput);
    const afterCreation = new Date();

    expect(result.created_at >= beforeCreation).toBe(true);
    expect(result.created_at <= afterCreation).toBe(true);
    expect(result.updated_at >= beforeCreation).toBe(true);
    expect(result.updated_at <= afterCreation).toBe(true);
  });

  it('should create multiple users successfully', async () => {
    const user1 = await createUser(testCustomerInput);
    const user2 = await createUser(testSellerInput);
    const user3 = await createUser(testUserWithoutAddress);

    // Check all users have different IDs
    expect(user1.id).not.toEqual(user2.id);
    expect(user1.id).not.toEqual(user3.id);
    expect(user2.id).not.toEqual(user3.id);

    // Verify all users are in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(3);
  });
});