import { http, HttpResponse } from 'msw';

const BASE = '/api/v2/wellness';

/** Wrap data in the ApiResponse<T> envelope the backend returns */
function ok<T>(data: T) {
  return HttpResponse.json({ success: true, data });
}

export const wellnessHandlers = [
  // -- Burnout Risk --
  http.get(`${BASE}/risk-score`, () => {
    return ok({
      score: 35,
      level: 'low',
      trend: 'stable',
      factors: [],
      history: [],
    });
  }),

  // -- Work Patterns --
  http.get(`${BASE}/patterns`, () => {
    return ok({
      period: '7d',
      total_hours: 40,
      breakdown: {},
      daily_patterns: [],
      peak_hours: [],
    });
  }),

  http.get(`${BASE}/patterns/heatmap`, () => {
    return ok({
      period: '7d',
      entries: [],
    });
  }),

  // -- Pulse Check-Ins --
  http.get(`${BASE}/pulse/history`, () => {
    return ok({
      entries: [],
      period: '90d',
    });
  }),

  http.post(`${BASE}/pulse`, () => {
    return ok({
      id: 'pulse-1',
      energy: 7,
      motivation: 8,
      stress: 3,
      created_at: new Date().toISOString(),
    });
  }),

  // -- Sensitivity (sub-resource of risk-score) --
  http.get(`${BASE}/sensitivity`, () => {
    return ok({ sensitivity: 'medium' });
  }),

  http.put(`${BASE}/risk-score/sensitivity`, () => {
    return ok({ sensitivity: 'medium', updated_at: new Date().toISOString() });
  }),

  // -- Schedule --
  http.get(`${BASE}/schedule`, () => {
    return ok({ recommendations: [], generated_at: new Date().toISOString() });
  }),

  http.get(`${BASE}/schedule/recommendations`, () => {
    return ok({ recommendations: [], generated_at: new Date().toISOString() });
  }),

  // -- Buffer Depth --
  http.get(`${BASE}/buffer-depth`, () => {
    return ok({ status: 'healthy', depth_days: 7 });
  }),

  // -- Boundaries --
  http.get(`${BASE}/boundaries`, () => {
    return ok({
      focus_hours: { start: '09:00', end: '17:00' },
      weekly_engagement_budget_mins: 120,
      dnd_mode: { enabled: false },
      availability_status: 'available',
      notification_batching: true,
    });
  }),

  http.put(`${BASE}/boundaries`, () => {
    return ok({
      focus_hours: { start: '09:00', end: '17:00' },
      weekly_engagement_budget_mins: 120,
      dnd_mode: { enabled: false },
      availability_status: 'available',
      notification_batching: true,
    });
  }),

  // -- Pulse data deletion --
  http.delete(`${BASE}/pulse`, () => {
    return ok({ deleted_count: 0 });
  }),

  // -- Benchmarks --
  http.get(`${BASE}/benchmark`, () => {
    return ok(null);
  }),
];
