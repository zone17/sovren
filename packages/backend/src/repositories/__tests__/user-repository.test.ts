import { UserRepository } from '../user-repository';
import { CreateUserProfile } from '../../services/user-service';

vi.mock('../../config/database');

/**
 * Chainable+thenable mock for Supabase client.
 */
function createMockChain(defaultResult: any = { data: null, error: null }) {
  let _result = defaultResult;

  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    delete: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    neq: vi.fn().mockImplementation(() => chain),
    ilike: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => Promise.resolve(_result)),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(_result)),
    then: vi.fn().mockImplementation((resolve: any) => resolve(_result)),
    _setResult(result: any) {
      _result = result;
      chain.single.mockImplementation(() => Promise.resolve(result));
      chain.then.mockImplementation((resolve: any) => resolve(result));
      return chain;
    },
  };

  return chain;
}

describe('User Repository', () => {
  let userRepository: UserRepository;
  let mockChain: ReturnType<typeof createMockChain>;
  let mockDatabase: any;

  const mockUser: CreateUserProfile = {
    nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    username: 'testuser',
    display_name: 'Test User',
    bio: 'A test user for our testing suite',
    avatar_url: 'https://example.com/avatar.jpg',
    email: 'test@example.com',
    email_verified: false,
    is_active: true,
    is_verified: false,
    last_login_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createMockChain();
    mockDatabase = {
      client: {
        from: vi.fn().mockReturnValue(mockChain),
      },
    };
    userRepository = new UserRepository(mockDatabase as any);
  });

  describe('Creating User Profiles', () => {
    it('should create a new user profile with valid data', async () => {
      const userData = { ...mockUser };
      const mockDbRecord = {
        id: 'user-uuid-123',
        ...userData,
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // findByNostrPubkey: not found (2 calls: one for existing check, one for username check is separate)
      // findByUsername: not found
      // insert().select().single(): returns created record
      let singleCallCount = 0;
      mockChain.single.mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount <= 2) {
          // findByNostrPubkey + findByUsername: not found
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        // insert().select().single(): success
        return Promise.resolve({ data: mockDbRecord, error: null });
      });

      const result = await userRepository.create(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.nostr_pubkey).toBe(userData.nostr_pubkey);
      expect(result.user?.username).toBe(userData.username);
      expect(result.user?.role).toBe('supporter');
      expect(result.user?.created_at).toBeInstanceOf(Date);
      expect(result.user?.updated_at).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should reject duplicate NOSTR public keys', async () => {
      const existingRecord = {
        id: 'existing-user',
        ...mockUser,
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // findByNostrPubkey: found (user exists)
      mockChain.single.mockResolvedValue({ data: existingRecord, error: null });

      const duplicateUser = { ...mockUser, username: 'different_username' };
      const result = await userRepository.create(duplicateUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.user).toBeUndefined();
    });

    it('should reject invalid NOSTR public key formats', async () => {
      const invalidKeys = [
        'invalid-key',
        '123', // Too short
        'xyz' + '0'.repeat(61), // Invalid characters
        '0'.repeat(63), // Too short
        '0'.repeat(65), // Too long
      ];

      for (const invalidKey of invalidKeys) {
        const userData = { ...mockUser, nostr_pubkey: invalidKey };
        const result = await userRepository.create(userData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid NOSTR public key');
      }
    });

    it('should handle username validation correctly', async () => {
      // Valid usernames
      const validUsernames = ['test123', 'user_name', 'a', 'A'.repeat(50)];

      for (let i = 0; i < validUsernames.length; i++) {
        const username = validUsernames[i];
        const pubkey = `${i.toString().padStart(4, '0')}${'a'.repeat(60)}`;
        const userData = { ...mockUser, nostr_pubkey: pubkey, username };

        // findByNostrPubkey: not found, findByUsername: not found, insert: success
        let callCount = 0;
        mockChain.single.mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
          }
          return Promise.resolve({
            data: {
              id: `user-${i}`,
              ...userData,
              role: 'supporter',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        });

        const result = await userRepository.create(userData);
        expect(result.success).toBe(true);
      }

      // Invalid usernames
      const invalidUsernames = ['a'.repeat(51), 'user-name', 'user name'];

      for (const username of invalidUsernames) {
        const pubkey = `${'b'.repeat(60)}0001`;
        const userData = { ...mockUser, nostr_pubkey: pubkey, username };

        // findByNostrPubkey needs to be not found for validation to proceed
        mockChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

        const result = await userRepository.create(userData);
        expect(result.success).toBe(false);
      }

      // Empty string skips validation
      const emptyPubkey = `${'c'.repeat(60)}0001`;
      const emptyUsernameData = { ...mockUser, nostr_pubkey: emptyPubkey, username: '' };
      let emptyCallCount = 0;
      mockChain.single.mockImplementation(() => {
        emptyCallCount++;
        if (emptyCallCount <= 1) {
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        return Promise.resolve({
          data: {
            id: 'user-empty',
            ...emptyUsernameData,
            username: null,
            role: 'supporter',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });
      });

      const emptyResult = await userRepository.create(emptyUsernameData);
      expect(emptyResult.success).toBe(true);
    });

    it('should create user with minimum required fields', async () => {
      const minimalUser: CreateUserProfile = {
        nostr_pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        email_verified: false,
        is_active: true,
        is_verified: false,
      };

      const mockDbRecord = {
        id: 'user-minimal',
        ...minimalUser,
        username: null,
        display_name: null,
        bio: null,
        avatar_url: null,
        email: null,
        role: 'supporter',
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let callCount = 0;
      mockChain.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // findByNostrPubkey: not found
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        // insert: success
        return Promise.resolve({ data: mockDbRecord, error: null });
      });

      const result = await userRepository.create(minimalUser);

      expect(result.success).toBe(true);
      expect(result.user?.username).toBeNull();
      expect(result.user?.display_name).toBeNull();
      expect(result.user?.role).toBe('supporter');
      expect(result.user?.is_active).toBe(true);
    });
  });

  describe('Retrieving User Profiles', () => {
    it('should find existing user by NOSTR public key', async () => {
      const mockDbRecord = {
        id: 'user-uuid-123',
        ...mockUser,
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockDbRecord, error: null });

      const result = await userRepository.findByNostrPubkey(mockUser.nostr_pubkey);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.nostr_pubkey).toBe(mockUser.nostr_pubkey);
      expect(result.user?.username).toBe(mockUser.username);
    });

    it('should return not found for non-existent NOSTR key', async () => {
      const nonExistentKey = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await userRepository.findByNostrPubkey(nonExistentKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.user).toBeUndefined();
    });

    it('should find user by username', async () => {
      const mockDbRecord = {
        id: 'user-uuid-123',
        ...mockUser,
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockDbRecord, error: null });

      const result = await userRepository.findByUsername(mockUser.username!);

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe(mockUser.username);
    });

    it('should handle case-insensitive username search', async () => {
      const mockDbRecord = {
        id: 'user-uuid-123',
        ...mockUser,
        username: 'testuser',
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockDbRecord, error: null });

      const result = await userRepository.findByUsername('TESTUSER');

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('testuser');
      // Verify ilike was used for case-insensitive search
      expect(mockChain.ilike).toHaveBeenCalledWith('username', 'TESTUSER');
    });
  });

  describe('Updating User Profiles', () => {
    it('should update user profile fields', async () => {
      const userId = 'user-uuid-123';
      const updateData = {
        display_name: 'Updated Display Name',
        bio: 'Updated bio description',
        avatar_url: 'https://example.com/new-avatar.jpg',
      };

      const mockDbRecord = {
        id: userId,
        ...mockUser,
        ...updateData,
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockDbRecord, error: null });

      const result = await userRepository.update(userId, updateData);

      expect(result.success).toBe(true);
      expect(result.user?.display_name).toBe(updateData.display_name);
      expect(result.user?.bio).toBe(updateData.bio);
      expect(result.user?.avatar_url).toBe(updateData.avatar_url);
      expect(result.user?.updated_at).toBeInstanceOf(Date);
    });

    it('should handle partial updates correctly', async () => {
      const userId = 'user-uuid-123';
      const mockDbRecord = {
        id: userId,
        ...mockUser,
        bio: 'New bio only',
        role: 'supporter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockDbRecord, error: null });

      const result = await userRepository.update(userId, { bio: 'New bio only' });

      expect(result.success).toBe(true);
      expect(result.user?.bio).toBe('New bio only');
      expect(result.user?.display_name).toBe(mockUser.display_name);
      expect(result.user?.username).toBe(mockUser.username);
    });
  });

  describe('Role Management', () => {
    it('should update user role with admin permissions', async () => {
      const userId = 'user-uuid-123';
      const mockDbRecord = {
        id: userId,
        ...mockUser,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockDbRecord, error: null });

      const result = await userRepository.updateRole(userId, 'admin', 'admin');

      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('admin');
    });

    it('should reject role updates from non-admin users', async () => {
      const userId = 'user-uuid-123';

      const result = await userRepository.updateRole(userId, 'admin', 'creator');

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('should validate role values', async () => {
      const userId = 'user-uuid-123';

      const result = await userRepository.updateRole(userId, 'invalid_role' as any, 'admin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid role');
    });
  });

  describe('Performance and Security', () => {
    it('should complete operations within performance requirements', async () => {
      const maxResponseTime = 200;
      const startTime = Date.now();

      // findByNostrPubkey: not found, findByUsername: not found
      let callCount = 0;
      mockChain.single.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        return Promise.resolve({
          data: {
            id: 'user-uuid',
            ...mockUser,
            role: 'supporter',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });
      });

      await userRepository.create(mockUser);

      // Reset for findByNostrPubkey
      mockChain.single.mockResolvedValue({
        data: {
          id: 'user-uuid',
          ...mockUser,
          role: 'supporter',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });
      await userRepository.findByNostrPubkey(mockUser.nostr_pubkey);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(maxResponseTime);
    });

    it('should handle SQL injection attempts safely', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        '<script>alert("xss")</script>',
        '${process.env.SECRET}',
      ];

      for (const maliciousInput of maliciousInputs) {
        const pubkey = Math.random().toString(16).substring(2).padEnd(64, '0');
        const userData = { ...mockUser, username: maliciousInput, nostr_pubkey: pubkey };

        // These should fail username validation (regex rejects special chars)
        mockChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

        const result = await userRepository.create(userData);

        // Should fail due to username format validation
        expect(result.success).toBe(false);
      }
    });

    it('should properly handle concurrent operations', async () => {
      const concurrentUsers = Array.from({ length: 5 }, (_, i) => ({
        ...mockUser,
        nostr_pubkey: i.toString().padStart(64, '0'),
        username: `user${i}`,
      }));

      // Each create() calls:
      //   1. findByNostrPubkey -> single() -> not found
      //   2. findByUsername -> single() -> not found
      //   3. insert().select().single() -> success
      // With concurrent calls, insert() marks a per-call context.
      // Track pending inserts: each insert() pushes a flag, single() pops it.
      const pendingInserts: boolean[] = [];
      mockChain.insert.mockImplementation(() => {
        pendingInserts.push(true);
        return mockChain;
      });

      mockChain.single.mockImplementation(() => {
        if (pendingInserts.length > 0) {
          pendingInserts.pop();
          return Promise.resolve({
            data: {
              id: `user-concurrent-${Date.now()}`,
              nostr_pubkey: '0'.repeat(64),
              username: 'user0',
              role: 'supporter',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
      });

      const promises = concurrentUsers.map((user) => userRepository.create(user));
      const results = await Promise.all(promises);

      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Statistics and Analytics', () => {
    it('should provide accurate user statistics', async () => {
      // user_stats view: not found, falls back to manual calculation
      let singleCalled = false;
      mockChain.single.mockImplementation(() => {
        if (!singleCalled) {
          singleCalled = true;
          // user_stats view doesn't exist
          return Promise.resolve({ data: null, error: { message: 'Not found' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      // Fallback: select('role').eq('is_active', true)
      mockChain.then.mockImplementation((resolve: any) =>
        resolve({
          data: [{ role: 'supporter' }, { role: 'supporter' }, { role: 'supporter' }],
          error: null,
        })
      );

      const stats = await userRepository.getStats();

      expect(stats.totalUsers).toBe(3);
      expect(stats.roleDistribution.supporter).toBe(3);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup test data in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // delete().neq() resolves via then
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: null, error: null }));

      await userRepository.cleanup();

      expect(mockDatabase.client.from).toHaveBeenCalledWith('users');
      expect(mockChain.delete).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
