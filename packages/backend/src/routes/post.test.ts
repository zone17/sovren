import request from 'supertest';
import { app } from '../index';

describe('Posts API', () => {
  it('GET /api/posts returns posts', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
    expect(res.body.data).toHaveProperty('posts');
    expect(Array.isArray(res.body.data.posts)).toBe(true);
  });

  it('POST /api/posts fails without auth', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({ title: 'Test', content: 'Test content' });
    expect(res.status).toBe(401);
  });
});
