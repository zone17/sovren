import { http, HttpResponse } from 'msw';

export const supabaseHandlers = [
  http.get('https://test-project.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ data: [] });
  }),

  http.post('https://test-project.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ data: [], count: 0 });
  }),

  http.patch('https://test-project.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ data: {} });
  }),
];
