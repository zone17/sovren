import { UserService } from '../user-service';

describe('User Management Service', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  describe('User Profile Creation', () => {
    it('should create a new user profile with NOSTR public key', async () => {
      // Given a valid NOSTR public key
      const nostrPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // When creating a user profile
      const result = await userService.createProfile({
        nostr_pubkey: nostrPubkey,
        username: 'testuser',
      });

      // Then it should succeed and return the profile
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.nostr_pubkey).toBe(nostrPubkey);
      expect(result.user?.role).toBe('supporter');
      expect(result.user?.username).toBe('testuser');
    });

    it('should reject user creation with invalid NOSTR public key', async () => {
      // Given an invalid NOSTR public key
      const invalidPubkey = 'invalid-key';

      // When attempting to create a user profile
      const result = await userService.createProfile({
        nostr_pubkey: invalidPubkey,
      });

      // Then it should fail with validation error
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid NOSTR public key format');
    });

    it('should prevent duplicate user profiles for same NOSTR key', async () => {
      // Given an existing user with a NOSTR public key
      const nostrPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await userService.createProfile({ nostr_pubkey: nostrPubkey });

      // When attempting to create another profile with same key
      const result = await userService.createProfile({ nostr_pubkey: nostrPubkey });

      // Then it should fail with conflict error
      expect(result.success).toBe(false);
      expect(result.error).toBe('User profile already exists for this NOSTR key');
    });
  });

  describe('User Profile Retrieval', () => {
    it('should retrieve user profile by NOSTR public key', async () => {
      // Given an existing user profile
      const nostrPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await userService.createProfile({
        nostr_pubkey: nostrPubkey,
        username: 'testuser',
      });

      // When retrieving by NOSTR public key
      const result = await userService.getProfile(nostrPubkey);

      // Then it should return the complete profile
      expect(result.success).toBe(true);
      expect(result.user?.nostr_pubkey).toBe(nostrPubkey);
      expect(result.user?.username).toBe('testuser');
    });

    it('should return not found for non-existent user', async () => {
      // Given a non-existent NOSTR public key
      const nonExistentPubkey = '9999999999abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // When attempting to retrieve the profile
      const result = await userService.getProfile(nonExistentPubkey);

      // Then it should return not found
      expect(result.success).toBe(false);
      expect(result.error).toBe('User profile not found');
    });
  });

  describe('User Profile Updates', () => {
    it('should allow users to update their own profile', async () => {
      // Given an authenticated user
      const nostrPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await userService.createProfile({ nostr_pubkey: nostrPubkey });

      // When updating their own profile data
      const result = await userService.updateProfile(nostrPubkey, {
        username: 'updated_username',
        bio: 'This is my updated bio',
      });

      // Then it should succeed with updated information
      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('updated_username');
      expect(result.user?.bio).toBe('This is my updated bio');
    });

    it('should prevent updates to non-existent user profiles', async () => {
      // Given a non-existent user
      const nonExistentPubkey = '9999999999abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // When attempting to update the profile
      const result = await userService.updateProfile(nonExistentPubkey, {
        username: 'newname',
      });

      // Then it should fail with not found error
      expect(result.success).toBe(false);
      expect(result.error).toBe('User profile not found');
    });
  });

  describe('User Role Management', () => {
    it('should assign default supporter role to new users', async () => {
      // Given a new user registration
      const nostrPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // When the profile is created
      const result = await userService.createProfile({ nostr_pubkey: nostrPubkey });

      // Then the role should default to supporter
      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('supporter');
    });

    it('should allow admins to change user roles', async () => {
      // Given an admin user and target user
      const adminPubkey = 'aaaaaaaaaaaaaaaa1234567890abcdef1234567890abcdef1234567890abcdef';
      const userPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // Create admin user (Code of Craft: Foundation first)
      await userService.createProfile({
        nostr_pubkey: adminPubkey,
        email_verified: true,
        is_active: true,
        is_verified: true
      });

      // Create target user
      await userService.createProfile({
        nostr_pubkey: userPubkey,
        email_verified: true,
        is_active: true,
        is_verified: true
      });

      // Bootstrap: Set admin role directly (simulating initial system setup)
      const adminUser = await userService.findByNostrPubkey(adminPubkey);
      if (adminUser.success && adminUser.user) {
        await userService.updateRoleById(adminUser.user.id!, 'admin', 'admin');
      }

      // When admin changes the target user's role
      const result = await userService.updateRole(userPubkey, 'creator', adminPubkey);

      // Then the role should be updated successfully
      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('creator');
    });

    it('should prevent non-admins from changing roles', async () => {
      // Given a non-admin user
      const userPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await userService.createProfile({ nostr_pubkey: userPubkey });

      // When attempting to change any user role
      const result = await userService.updateRole(userPubkey, 'creator', 'supporter');

      // Then it should fail with permission error
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions to change user roles');
    });
  });

  describe('Service Statistics', () => {
    it('should provide accurate user statistics', async () => {
      // Given multiple users with different roles
      const user1 = '1111111111abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const user2 = '2222222222abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const user3 = '3333333333abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const adminPubkey = 'aaaaaaaaaaaaaaaa1234567890abcdef1234567890abcdef1234567890abcdef';

      // Create admin user first (Code of Craft: Foundation before operations)
      await userService.createProfile({
        nostr_pubkey: adminPubkey,
        email_verified: true,
        is_active: true,
        is_verified: true
      });

      // Bootstrap admin role
      const adminUser = await userService.findByNostrPubkey(adminPubkey);
      if (adminUser.success && adminUser.user) {
        await userService.updateRoleById(adminUser.user.id!, 'admin', 'admin');
      }

      await userService.createProfile({ nostr_pubkey: user1 });
      await userService.createProfile({ nostr_pubkey: user2 });
      await userService.createProfile({ nostr_pubkey: user3 });

      // Promote one user to creator using admin NOSTR pubkey
      await userService.updateRole(user2, 'creator', adminPubkey);

      // When getting statistics
      const result = await userService.getStats();

      // Then it should return accurate counts
      expect(result.success).toBe(true);
      expect(result.stats?.totalUsers).toBe(4); // 3 regular users + 1 admin
      expect(result.stats?.roleDistribution.supporter).toBe(2);
      expect(result.stats?.roleDistribution.creator).toBe(1);
      expect(result.stats?.roleDistribution.admin).toBe(1);
    });
  });
});
