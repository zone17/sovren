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

  it('Redis is accessible and responds to PING', async () => {
    const url = new URL(process.env.REDIS_URL!);
    const net = await import('net');
    const response = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port: parseInt(url.port) }, () => {
        socket.write('PING\r\n');
      });
      socket.on('data', (data) => {
        socket.end();
        resolve(data.toString().trim());
      });
      socket.on('error', reject);
    });
    expect(response).toBe('+PONG');
  });
});
