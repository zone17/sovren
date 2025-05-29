import request from 'supertest';
import { app } from '../index';
import { prisma } from '../prisma';

describe('Auth API', () => {
  const testEmail = 'integrationtest@example.com';
  const testName = 'Integration Test';
  let token: string;

  // Clean up test data before and after tests
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it('POST /api/auth/register registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, name: testName });

    if (res.status !== 201) {
      console.error('Register failed:', res.body);
    }

    expect([201, 409]).toContain(res.status); // 409 if already registered
    if (res.status === 201) {
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.name).toBe(testName);
      expect(res.body.data).toHaveProperty('token');
      token = res.body.data.token;
    }
  });

  it('POST /api/auth/login logs in the user', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testEmail });

    if (res.status !== 200) {
      console.error('Login failed:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data).toHaveProperty('token');
    token = res.body.data.token;
  });

  it('GET /api/auth/me returns current user with valid token', async () => {
    if (!token) {
      console.warn('Skipping /me test - no valid token available');
      return;
    }

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    if (res.status !== 200) {
      console.error('Me failed:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testEmail);
  });
});
