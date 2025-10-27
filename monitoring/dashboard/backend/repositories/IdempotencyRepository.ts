/**
 * Idempotency Repository
 *
 * Data access layer for idempotency cache operations.
 * Handles database interactions for storing and retrieving idempotency keys.
 *
 * @module repositories/IdempotencyRepository
 * @story PAY-010
 */

import {
  IdempotencyCache,
  IdempotencyCacheRequest,
  IdempotencyCleanupStats,
} from '../types/idempotency';

/**
 * Database client interface (PostgreSQL/Supabase)
 */
interface DatabaseClient {
  query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

/**
 * Repository for idempotency cache database operations
 */
export class IdempotencyRepository {
  private static readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private db: DatabaseClient) {}

  /**
   * Store new idempotency cache entry
   *
   * @param request - Cache entry data
   * @returns True if stored successfully
   * @throws Error if database operation fails
   */
  async store(request: IdempotencyCacheRequest): Promise<boolean> {
    const expiresAt = new Date(Date.now() + IdempotencyRepository.TTL_MS);

    const query = `
      INSERT INTO idempotency_cache (
        idempotency_key,
        request_hash,
        http_method,
        endpoint_path,
        response_status,
        response_body,
        response_headers,
        expires_at,
        client_ip,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const params = [
      request.idempotency_key,
      request.request_hash,
      request.http_method,
      request.endpoint_path,
      request.response_status,
      JSON.stringify(request.response_body),
      JSON.stringify(request.response_headers || {}),
      expiresAt,
      request.client_ip || null,
      request.user_agent || null,
    ];

    const result = await this.db.query(query, params);
    return result.rowCount > 0;
  }

  /**
   * Find cache entry by idempotency key
   *
   * @param idempotencyKey - UUID v4 idempotency key
   * @returns Cache entry or null if not found
   * @throws Error if database query fails
   */
  async findByKey(idempotencyKey: string): Promise<IdempotencyCache | null> {
    const query = `
      SELECT * FROM idempotency_cache
      WHERE idempotency_key = $1
    `;

    const result = await this.db.query(query, [idempotencyKey]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      idempotency_key: row.idempotency_key,
      request_hash: row.request_hash,
      http_method: row.http_method,
      endpoint_path: row.endpoint_path,
      response_status: row.response_status,
      response_body: JSON.parse(row.response_body),
      response_headers: JSON.parse(row.response_headers),
      created_at: new Date(row.created_at),
      expires_at: new Date(row.expires_at),
      client_ip: row.client_ip,
      user_agent: row.user_agent,
    };
  }

  /**
   * Delete cache entry by key
   *
   * @param idempotencyKey - UUID v4 idempotency key
   * @returns True if deleted, false if not found
   * @throws Error if database operation fails
   */
  async deleteByKey(idempotencyKey: string): Promise<boolean> {
    const query = `
      DELETE FROM idempotency_cache
      WHERE idempotency_key = $1
    `;

    const result = await this.db.query(query, [idempotencyKey]);
    return result.rowCount > 0;
  }

  /**
   * Delete all expired cache entries
   *
   * @returns Cleanup statistics
   * @throws Error if database operation fails
   */
  async cleanupExpired(): Promise<IdempotencyCleanupStats> {
    const startTime = Date.now();
    const cleanupAt = new Date();

    const query = `
      DELETE FROM idempotency_cache
      WHERE expires_at < NOW()
    `;

    const result = await this.db.query(query);

    const endTime = Date.now();

    return {
      deleted_count: result.rowCount,
      cleanup_at: cleanupAt,
      duration_ms: endTime - startTime,
    };
  }

  /**
   * Count total cache entries
   *
   * @returns Total number of entries
   * @throws Error if database query fails
   */
  async countEntries(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM idempotency_cache
    `;

    const result = await this.db.query(query);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find all expired idempotency keys
   *
   * @returns Array of expired keys
   * @throws Error if database query fails
   */
  async findExpiredKeys(): Promise<string[]> {
    const query = `
      SELECT idempotency_key
      FROM idempotency_cache
      WHERE expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map((row) => row.idempotency_key);
  }

  /**
   * Get cache statistics
   *
   * @returns Statistics about cache usage
   */
  async getStats(): Promise<{
    total_entries: number;
    expired_entries: number;
    oldest_entry: Date | null;
    newest_entry: Date | null;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_entries,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry
      FROM idempotency_cache
    `;

    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      total_entries: parseInt(row.total_entries, 10),
      expired_entries: parseInt(row.expired_entries, 10),
      oldest_entry: row.oldest_entry ? new Date(row.oldest_entry) : null,
      newest_entry: row.newest_entry ? new Date(row.newest_entry) : null,
    };
  }
}
