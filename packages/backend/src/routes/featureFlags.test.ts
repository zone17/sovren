import request from 'supertest';
import express from 'express';
import { featureFlagsRouter } from './featureFlags';

const app = express();
app.use(express.json());
app.use('/api/feature-flags', featureFlagsRouter);

describe('Feature Flags API', () => {
  let createdFlagId: string;
  const testFlag = {
    key: 'test-flag',
    value: true,
    description: 'A test feature flag',
  };

  it('GET /api/feature-flags returns flags', async () => {
    const res = await request(app).get('/api/feature-flags');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
    expect(res.body.data).toHaveProperty('flags');
    expect(Array.isArray(res.body.data.flags)).toBe(true);
  });

  it('POST /api/feature-flags creates a flag (should fail without auth)', async () => {
    const res = await request(app).post('/api/feature-flags').send(testFlag);
    expect(res.status).toBe(401);
  });

  // You can add a valid token here for a real integration test
  it.skip('POST /api/feature-flags creates a flag (with auth)', async () => {
    const res = await request(app)
      .post('/api/feature-flags')
      .set('Authorization', 'Bearer <valid_token>')
      .send(testFlag);
    expect(res.status).toBe(201);
    expect(res.body.data.flag).toHaveProperty('id');
    createdFlagId = res.body.data.flag.id;
  });

  it.skip('PATCH /api/feature-flags/:id updates a flag (with auth)', async () => {
    const res = await request(app)
      .patch(`/api/feature-flags/${createdFlagId}`)
      .set('Authorization', 'Bearer <valid_token>')
      .send({ value: false });
    expect(res.status).toBe(200);
    expect(res.body.data.flag.value).toBe(false);
  });

  it.skip('DELETE /api/feature-flags/:id deletes a flag (with auth)', async () => {
    const res = await request(app)
      .delete(`/api/feature-flags/${createdFlagId}`)
      .set('Authorization', 'Bearer <valid_token>');
    expect(res.status).toBe(204);
  });
});
