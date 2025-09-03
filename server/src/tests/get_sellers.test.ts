import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getSellers } from '../handlers/get_sellers';

// Test data for sellers and customers
const testSeller1: CreateUserInput = {
  email: 'seller1@example.com',
  full_name: 'Seller One',
  phone: '0901234567',
  address: '123 Seller Street, Ho Chi Minh City',
  role: 'seller'
};

const testSeller2: CreateUserInput = {
  email: 'seller2@example.com',
  full_name: 'Seller Two',
  phone: '0901234568',
  address: '456 Seller Avenue, Hanoi',
  role: 'seller'
};

const testCustomer: CreateUserInput = {
  email: 'customer@example.com',
  full_name: 'Customer One',
  phone: '0901234569',
  address: '789 Customer Road, Da Nang',
  role: 'customer'
};

describe('getSellers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all sellers from database', async () => {
    // Create test users: 2 sellers and 1 customer
    await db.insert(usersTable)
      .values([testSeller1, testSeller2, testCustomer])
      .execute();

    const result = await getSellers();

    // Should return only the 2 sellers
    expect(result).toHaveLength(2);
    
    // Verify all returned users are sellers
    result.forEach(user => {
      expect(user.role).toEqual('seller');
    });

    // Verify seller data
    const sellerEmails = result.map(seller => seller.email).sort();
    expect(sellerEmails).toEqual(['seller1@example.com', 'seller2@example.com']);
    
    const sellerNames = result.map(seller => seller.full_name).sort();
    expect(sellerNames).toEqual(['Seller One', 'Seller Two']);
  });

  it('should return empty array when no sellers exist', async () => {
    // Create only customers
    await db.insert(usersTable)
      .values([testCustomer])
      .execute();

    const result = await getSellers();

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should return empty array when no users exist', async () => {
    const result = await getSellers();

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should return seller with all required fields', async () => {
    // Create a single seller
    await db.insert(usersTable)
      .values([testSeller1])
      .execute();

    const result = await getSellers();

    expect(result).toHaveLength(1);
    
    const seller = result[0];
    expect(seller.id).toBeDefined();
    expect(seller.email).toEqual('seller1@example.com');
    expect(seller.full_name).toEqual('Seller One');
    expect(seller.phone).toEqual('0901234567');
    expect(seller.address).toEqual('123 Seller Street, Ho Chi Minh City');
    expect(seller.role).toEqual('seller');
    expect(seller.created_at).toBeInstanceOf(Date);
    expect(seller.updated_at).toBeInstanceOf(Date);
  });

  it('should handle sellers with null address', async () => {
    const sellerWithNullAddress: CreateUserInput = {
      email: 'seller_no_address@example.com',
      full_name: 'Seller No Address',
      phone: '0901234570',
      address: null,
      role: 'seller'
    };

    await db.insert(usersTable)
      .values([sellerWithNullAddress])
      .execute();

    const result = await getSellers();

    expect(result).toHaveLength(1);
    expect(result[0].address).toBeNull();
    expect(result[0].role).toEqual('seller');
    expect(result[0].email).toEqual('seller_no_address@example.com');
  });

  it('should return multiple sellers in database order', async () => {
    // Create multiple sellers
    const sellers: CreateUserInput[] = [
      {
        email: 'seller_alpha@example.com',
        full_name: 'Alpha Seller',
        phone: '0901111111',
        address: 'Alpha Street',
        role: 'seller'
      },
      {
        email: 'seller_beta@example.com',
        full_name: 'Beta Seller',
        phone: '0901111112',
        address: 'Beta Street',
        role: 'seller'
      },
      {
        email: 'seller_gamma@example.com',
        full_name: 'Gamma Seller',
        phone: '0901111113',
        address: 'Gamma Street',
        role: 'seller'
      }
    ];

    await db.insert(usersTable)
      .values(sellers)
      .execute();

    const result = await getSellers();

    expect(result).toHaveLength(3);
    
    // Verify all are sellers
    result.forEach(user => {
      expect(user.role).toEqual('seller');
    });

    // Verify IDs are in ascending order (database insertion order)
    const ids = result.map(seller => seller.id);
    const sortedIds = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sortedIds);
  });
});