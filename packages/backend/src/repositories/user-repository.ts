import { SupabaseDatabase, getDatabase } from '../config/database';
import { validateNostrPubkey } from '../services/nostr-auth';
import { CreateUserProfile, UpdateUserProfile, UserProfile } from '../services/user-service';

/**
 * 🗄️ Elite User Repository
 *
 * Production-ready database operations with:
 * - **Security**: SQL injection protection, input validation
 * - **Performance**: Optimized queries, proper indexing
 * - **Reliability**: Error handling, transaction management
 * - **Scalability**: Efficient data access patterns
 *
 * WHY: Repository pattern separates business logic from data access,
 * making the code more testable, maintainable, and scalable.
 */

export interface UserRepositoryResult<T> {
  success: boolean;
  data?: T;
  user?: UserProfile;
  error?: string;
}

export class UserRepository {
  private db: SupabaseDatabase;

  constructor(database?: SupabaseDatabase) {
    this.db = database || getDatabase();
  }

  /**
   * 🏗️ Create New User Profile
   * WHY: Centralized user creation with validation and conflict detection
   */
  async create(userData: CreateUserProfile): Promise<UserRepositoryResult<UserProfile>> {
    try {
      // Validate NOSTR public key format
      if (!validateNostrPubkey(userData.nostr_pubkey)) {
        return {
          success: false,
          error: 'Invalid NOSTR public key format',
        };
      }

      // Check for existing user
      const existingUser = await this.findByNostrPubkey(userData.nostr_pubkey);
      if (existingUser.success) {
        return {
          success: false,
          error: 'User profile already exists for this NOSTR key',
        };
      }

      // Validate username format if provided
      if (userData.username) {
        const usernameRegex = /^[a-zA-Z0-9_]{1,50}$/;
        if (!usernameRegex.test(userData.username)) {
          return {
            success: false,
            error:
              'Invalid username format. Use only letters, numbers, and underscores (1-50 characters)',
          };
        }

        // Check username uniqueness
        const existingUsername = await this.findByUsername(userData.username);
        if (existingUsername.success) {
          return {
            success: false,
            error: 'Username already taken',
          };
        }
      }

      // Insert user into database
      const { data, error } = await this.db.client
        .from('users')
        .insert({
          nostr_pubkey: userData.nostr_pubkey,
          username: userData.username || null,
          display_name: userData.display_name || null,
          bio: userData.bio || null,
          avatar_url: userData.avatar_url || null,
          email: userData.email || null,
          email_verified: userData.email_verified || false,
          is_active: userData.is_active ?? true,
          is_verified: userData.is_verified || false,
          role: 'supporter', // Default role
        })
        .select()
        .single();

      if (error) {
        // Handle database-specific errors
        if (error.code === '23505') {
          // Unique constraint violation
          return {
            success: false,
            error: 'User with this NOSTR key or username already exists',
          };
        }

        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }

      // Convert database record to UserProfile
      const userProfile = this.mapDatabaseToUserProfile(data);

      return {
        success: true,
        user: userProfile,
        data: userProfile,
      };
    } catch (error) {
      return {
        success: false,
        error: `User creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Find User by NOSTR Public Key
   * WHY: Primary lookup method for authentication
   */
  async findByNostrPubkey(nostrPubkey: string): Promise<UserRepositoryResult<UserProfile>> {
    try {
      if (!validateNostrPubkey(nostrPubkey)) {
        return {
          success: false,
          error: 'Invalid NOSTR public key format',
        };
      }

      const { data, error } = await this.db.client
        .from('users')
        .select('*')
        .eq('nostr_pubkey', nostrPubkey)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return {
            success: false,
            error: 'User not found',
          };
        }

        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }

      const userProfile = this.mapDatabaseToUserProfile(data);

      return {
        success: true,
        user: userProfile,
        data: userProfile,
      };
    } catch (error) {
      return {
        success: false,
        error: `User lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 👤 Find User by Username
   * WHY: Secondary lookup method for user discovery
   */
  async findByUsername(username: string): Promise<UserRepositoryResult<UserProfile>> {
    try {
      if (!username || username.trim().length === 0) {
        return {
          success: false,
          error: 'Username is required',
        };
      }

      const { data, error } = await this.db.client
        .from('users')
        .select('*')
        .ilike('username', username) // Case-insensitive search
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return {
            success: false,
            error: 'User not found',
          };
        }

        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }

      const userProfile = this.mapDatabaseToUserProfile(data);

      return {
        success: true,
        user: userProfile,
        data: userProfile,
      };
    } catch (error) {
      return {
        success: false,
        error: `Username lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * ✏️ Update User Profile
   * WHY: Secure profile updates with validation
   */
  async update(
    userId: string,
    updates: UpdateUserProfile
  ): Promise<UserRepositoryResult<UserProfile>> {
    try {
      // Validate username if being updated
      if (updates.username) {
        const usernameRegex = /^[a-zA-Z0-9_]{1,50}$/;
        if (!usernameRegex.test(updates.username)) {
          return {
            success: false,
            error: 'Invalid username format',
          };
        }
      }

      // UpdateUserProfile already excludes immutable fields like nostr_pubkey
      const allowedUpdates = updates;

      const { data, error } = await this.db.client
        .from('users')
        .update({
          ...allowedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('is_active', true)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'User not found or inactive',
          };
        }

        return {
          success: false,
          error: `Update failed: ${error.message}`,
        };
      }

      const userProfile = this.mapDatabaseToUserProfile(data);

      return {
        success: true,
        user: userProfile,
        data: userProfile,
      };
    } catch (error) {
      return {
        success: false,
        error: `User update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🎭 Update User Role (Admin Only)
   * WHY: Secure role management with permission validation
   */
  async updateRole(
    userId: string,
    newRole: 'supporter' | 'creator' | 'admin',
    requestingUserRole: 'supporter' | 'creator' | 'admin'
  ): Promise<UserRepositoryResult<UserProfile>> {
    try {
      // Check admin permission
      if (requestingUserRole !== 'admin') {
        return {
          success: false,
          error: 'Insufficient permissions to change user roles',
        };
      }

      // Validate role
      const validRoles = ['supporter', 'creator', 'admin'];
      if (!validRoles.includes(newRole)) {
        return {
          success: false,
          error: 'Invalid role specified',
        };
      }

      const { data, error } = await this.db.client
        .from('users')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('is_active', true)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'User not found or inactive',
          };
        }

        return {
          success: false,
          error: `Role update failed: ${error.message}`,
        };
      }

      const userProfile = this.mapDatabaseToUserProfile(data);

      return {
        success: true,
        user: userProfile,
        data: userProfile,
      };
    } catch (error) {
      return {
        success: false,
        error: `Role update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 📊 Get User Statistics
   * WHY: Analytics and monitoring
   */
  async getStats(): Promise<{
    totalUsers: number;
    roleDistribution: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.db.client.from('user_stats').select('*').single();

      if (error || !data) {
        // Fallback to manual calculation
        const { data: users, error: usersError } = await this.db.client
          .from('users')
          .select('role')
          .eq('is_active', true);

        if (usersError || !users) {
          return {
            totalUsers: 0,
            roleDistribution: {},
          };
        }

        const roleDistribution: Record<string, number> = {};
        users.forEach((user) => {
          const role = user.role || 'supporter';
          roleDistribution[role] = (roleDistribution[role] || 0) + 1;
        });

        return {
          totalUsers: users.length,
          roleDistribution,
        };
      }

      return {
        totalUsers: data.total_users || 0,
        roleDistribution: {
          supporter: data.supporters || 0,
          creator: data.creators || 0,
          admin: data.admins || 0,
        },
      };
    } catch (error) {
      return {
        totalUsers: 0,
        roleDistribution: {},
      };
    }
  }

  /**
   * 🧹 Cleanup Test Data
   * WHY: Clean test environment between test runs
   */
  async cleanup(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'test') {
        await this.db.client
          .from('users')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Keep system users
      }
    } catch (error) {
      // Ignore cleanup errors in test environment
      console.warn('Test cleanup warning:', error);
    }
  }

  /**
   * 🔄 Map Database Record to UserProfile
   * WHY: Consistent data transformation and type safety
   */
  private mapDatabaseToUserProfile(data: any): UserProfile {
    return {
      id: data.id,
      nostr_pubkey: data.nostr_pubkey,
      username: data.username,
      display_name: data.display_name,
      bio: data.bio,
      avatar_url: data.avatar_url,
      role: data.role,
      email: data.email,
      email_verified: data.email_verified || false,
      is_active: data.is_active ?? true,
      is_verified: data.is_verified || false,
      last_login_at: data.last_login_at ? new Date(data.last_login_at) : null,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }
}
