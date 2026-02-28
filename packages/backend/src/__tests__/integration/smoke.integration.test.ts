import { describe, it, expect } from 'vitest';
import pg from 'pg';

describe('Testcontainers Infrastructure', () => {
  it('PostgreSQL has schema from migrations', async () => {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 5"
    );
    expect(result.rows.length).toBeGreaterThan(0);
    await client.end();
  });

  it('Redis is accessible', async () => {
    const url = new URL(process.env.REDIS_URL!);
    const net = await import('net');
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port: parseInt(url.port) }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', reject);
    });
  });
});
