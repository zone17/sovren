import { http } from 'msw';
import { jsonOk, jsonPaginated, TEST_TIMESTAMP } from './helpers';

const sampleContent = {
  id: 'content-1',
  title: 'Test Post',
  body: 'Content body',
  status: 'published',
  authorId: 'user-1',
  createdAt: TEST_TIMESTAMP,
};

export const contentHandlers = [
  http.get('/api/v1/content', () => {
    return jsonPaginated([sampleContent], { page: 1, limit: 20, total: 1 });
  }),

  http.get('/api/v1/content/search', () => {
    return jsonPaginated([sampleContent], { page: 1, limit: 20, total: 1 });
  }),

  http.get('/api/v1/content/recommendations', () => {
    return jsonOk([sampleContent]);
  }),

  http.get('/api/v1/content/:id', ({ params }) => {
    return jsonOk({ ...sampleContent, id: params.id as string });
  }),

  http.get('/api/v1/content/analytics/:id', ({ params }) => {
    return jsonOk({
      contentId: params.id,
      views: 150,
      likes: 32,
      shares: 8,
      period: '30d',
    });
  }),

  http.post('/api/v1/content/publish', () => {
    return jsonOk({
      ...sampleContent,
      id: 'content-new',
      title: 'New Post',
      body: '',
      status: 'draft',
    });
  }),

  http.put('/api/v1/content/:id', ({ params }) => {
    return jsonOk({
      ...sampleContent,
      id: params.id as string,
      title: 'Updated Post',
      body: 'Updated body',
    });
  }),

  http.delete('/api/v1/content/:id', () => {
    return jsonOk({ deleted: true });
  }),
];
