import { http, HttpResponse } from 'msw';

export const contentHandlers = [
  http.get('/api/content', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'content-1',
          title: 'Test Post',
          body: 'Content body',
          status: 'published',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
    });
  }),

  http.get('/api/content/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: 'Test Post',
      body: 'Content body',
      status: 'published',
      authorId: 'user-1',
      createdAt: new Date().toISOString(),
    });
  }),

  http.post('/api/content', () => {
    return HttpResponse.json({
      id: 'content-new',
      title: 'New Post',
      body: '',
      status: 'draft',
    });
  }),

  http.put('/api/content/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: 'Updated Post',
      body: 'Updated body',
      status: 'published',
    });
  }),

  http.delete('/api/content/:id', () => {
    return HttpResponse.json({ success: true });
  }),
];
