import { http } from 'msw';
import { TEST_TIMESTAMP } from './helpers';
import { HttpResponse } from 'msw';

/**
 * Supabase PostgREST handlers.
 * Supabase has its own response format (not wrapped in ApiResponse),
 * so these return raw arrays/objects matching PostgREST conventions.
 */
export const supabaseHandlers = [
  http.get('https://test-project.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([]);
  }),

  http.post('https://test-project.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([{ id: 'new-1', created_at: TEST_TIMESTAMP }]);
  }),

  http.patch('https://test-project.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([{ id: 'updated-1', updated_at: TEST_TIMESTAMP }]);
  }),
];
