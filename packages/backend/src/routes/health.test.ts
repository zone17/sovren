import request from 'supertest';
import { app } from '../index';

describe('GET /health', () => {
  it('should return status ok and database ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body.services).toHaveProperty('database', 'ok');
  });
});
