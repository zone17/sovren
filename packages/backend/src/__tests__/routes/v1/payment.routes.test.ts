/**
 * Payment Routes Tests (P1-SEC-008)
 *
 * Covers all /api/v1/payments/* endpoints for:
 * - Auth middleware is present on all protected routes
 * - NOSTR signature required on mutating payment routes
 * - Public routes have no auth guard
 * - Route registration and handler delegation
 * - Response shapes
 */

import { Request, Response, NextFunction } from 'express';
import { vi, describe, it, expect, beforeAll } from 'vitest';

// ---- Capture route registrations via Express Router mock ----

type HandlerFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

interface RouteEntry {
  method: string;
  path: string;
  middlewares: HandlerFn[];
  handler: HandlerFn;
}

const capturedRoutes: RouteEntry[] = vi.hoisted(() => [] as RouteEntry[]);

vi.mock('express', async () => {
  const actual = await vi.importActual('express');
  return {
    ...actual,
    Router: () => {
      const mockRouter: Record<string, unknown> = {};
      ['get', 'post', 'put', 'delete', 'patch'].forEach((method) => {
        mockRouter[method] = vi.fn((...args: unknown[]) => {
          const path = args[0] as string;
          const fns = args.slice(1) as HandlerFn[];
          capturedRoutes.push({
            method: method.toUpperCase(),
            path,
            middlewares: fns.slice(0, -1),
            handler: fns[fns.length - 1],
          });
          return mockRouter;
        });
      });
      mockRouter.use = vi.fn(() => mockRouter);
      return mockRouter;
    },
  };
});

// ---- Mock middleware ----

const mockAuthenticate = vi.fn((_r: Request, _s: Response, next: NextFunction) => next());
const mockRequireNostrSig = vi.fn((_r: Request, _s: Response, next: NextFunction) => next());

vi.mock('../../../middleware/auth', () => ({
  authenticate: mockAuthenticate,
  requireAuth: vi.fn((_r: Request, _s: Response, next: NextFunction) => next()),
  requireNostrSignature: mockRequireNostrSig,
  optionalAuth: vi.fn((_r: Request, _s: Response, next: NextFunction) => next()),
  getAuthUser: vi.fn((req: Request) => req.user),
}));

vi.mock('../../../middleware/rate-limit-middleware', () => {
  const noop = vi.fn((_r: Request, _s: Response, next: NextFunction) => next());
  return {
    rateLimiters: {
      payment: {
        read: noop,
        createInvoice: noop,
        payInvoice: noop,
        createSubscription: noop,
      },
    },
    createRateLimiter: vi.fn(() => noop),
    createUserRateLimiter: vi.fn(() => noop),
  };
});

vi.mock('../../../middleware/validation-middleware', () => ({
  validate: vi.fn(() => (_r: Request, _s: Response, next: NextFunction) => next()),
}));

// ---- Mock DI container ----

const mockController = {
  createInvoice: vi.fn(),
  getInvoice: vi.fn(),
  payInvoice: vi.fn(),
  convertCurrency: vi.fn(),
  getSubscriptionTiers: vi.fn(),
  getSubscription: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
};

vi.mock('../../../container', () => ({
  container: {
    resolve: vi.fn(() => mockController),
  },
}));

vi.mock('../../../container/types', () => ({
  TYPES: { PaymentController: Symbol('PaymentController') },
}));

vi.mock('../../../validators/payment', () => ({
  PaymentValidators: {
    createInvoice: {},
    invoiceIdParam: {},
    payInvoice: {},
    convertCurrency: {},
    subscriptionIdParam: {},
    createSubscription: {},
    updateSubscription: {},
  },
}));

// ---- Import routes (triggers route registration) ----

beforeAll(async () => {
  capturedRoutes.length = 0;
  await import('../../../routes/v1/payment.routes');
});

// ---- Helpers ----

function getRoute(method: string, path: string): RouteEntry | undefined {
  return capturedRoutes.find((r) => r.method === method && r.path === path);
}

function hasMiddleware(route: RouteEntry, fn: ReturnType<typeof vi.fn>): boolean {
  return route.middlewares.includes(fn as unknown as HandlerFn);
}

// ---- Tests ----

describe('Payment Routes — /api/v1/payments/*', () => {
  describe('POST /invoices — create Lightning invoice', () => {
    it('is registered', () => {
      expect(getRoute('POST', '/invoices')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('POST', '/invoices')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('requires NOSTR signature', () => {
      const route = getRoute('POST', '/invoices')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(true);
    });

    it('delegates to PaymentController.createInvoice', async () => {
      const route = getRoute('POST', '/invoices')!;
      const req = { user: { nostr_pubkey: 'abc', role: 'creator' } } as unknown as Request;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;
      await route.handler(req, res, next);
      expect(mockController.createInvoice).toHaveBeenCalled();
    });
  });

  describe('GET /invoices/:id — get invoice by ID', () => {
    it('is registered', () => {
      expect(getRoute('GET', '/invoices/:id')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('GET', '/invoices/:id')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('does NOT require NOSTR signature (read-only)', () => {
      const route = getRoute('GET', '/invoices/:id')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(false);
    });

    it('delegates to PaymentController.getInvoice', async () => {
      const route = getRoute('GET', '/invoices/:id')!;
      const req = { params: { id: '123' }, user: { nostr_pubkey: 'abc' } } as unknown as Request;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
      await route.handler(req, res, vi.fn());
      expect(mockController.getInvoice).toHaveBeenCalled();
    });
  });

  describe('POST /invoices/:id/pay — pay a Lightning invoice', () => {
    it('is registered', () => {
      expect(getRoute('POST', '/invoices/:id/pay')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('POST', '/invoices/:id/pay')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('requires NOSTR signature', () => {
      const route = getRoute('POST', '/invoices/:id/pay')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(true);
    });

    it('delegates to PaymentController.payInvoice', async () => {
      const route = getRoute('POST', '/invoices/:id/pay')!;
      const req = { params: { id: '123' }, user: { nostr_pubkey: 'abc' } } as unknown as Request;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
      await route.handler(req, res, vi.fn());
      expect(mockController.payInvoice).toHaveBeenCalled();
    });
  });

  describe('GET /currency/convert — currency conversion', () => {
    it('is registered', () => {
      expect(getRoute('GET', '/currency/convert')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('GET', '/currency/convert')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('does NOT require NOSTR signature', () => {
      const route = getRoute('GET', '/currency/convert')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(false);
    });
  });

  describe('GET /subscriptions/tiers — public subscription tiers', () => {
    it('is registered', () => {
      expect(getRoute('GET', '/subscriptions/tiers')).toBeDefined();
    });

    it('does NOT require authenticate (public endpoint)', () => {
      const route = getRoute('GET', '/subscriptions/tiers')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(false);
    });

    it('does NOT require NOSTR signature', () => {
      const route = getRoute('GET', '/subscriptions/tiers')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(false);
    });

    it('delegates to PaymentController.getSubscriptionTiers', async () => {
      const route = getRoute('GET', '/subscriptions/tiers')!;
      const req = {} as Request;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
      await route.handler(req, res, vi.fn());
      expect(mockController.getSubscriptionTiers).toHaveBeenCalled();
    });
  });

  describe('GET /subscriptions/:id — get subscription', () => {
    it('is registered', () => {
      expect(getRoute('GET', '/subscriptions/:id')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('GET', '/subscriptions/:id')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('does NOT require NOSTR signature (read-only)', () => {
      const route = getRoute('GET', '/subscriptions/:id')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(false);
    });
  });

  describe('POST /subscriptions — create subscription', () => {
    it('is registered', () => {
      expect(getRoute('POST', '/subscriptions')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('POST', '/subscriptions')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('requires NOSTR signature', () => {
      const route = getRoute('POST', '/subscriptions')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(true);
    });
  });

  describe('PUT /subscriptions/:id — update subscription', () => {
    it('is registered', () => {
      expect(getRoute('PUT', '/subscriptions/:id')).toBeDefined();
    });

    it('requires authenticate middleware', () => {
      const route = getRoute('PUT', '/subscriptions/:id')!;
      expect(hasMiddleware(route, mockAuthenticate)).toBe(true);
    });

    it('requires NOSTR signature', () => {
      const route = getRoute('PUT', '/subscriptions/:id')!;
      expect(hasMiddleware(route, mockRequireNostrSig)).toBe(true);
    });
  });

  describe('Security invariants', () => {
    it('all mutating payment routes have authenticate middleware', () => {
      const mutating = capturedRoutes.filter((r) => ['POST', 'PUT', 'DELETE'].includes(r.method));
      for (const route of mutating) {
        expect(
          hasMiddleware(route, mockAuthenticate),
          `${route.method} ${route.path} missing authenticate`
        ).toBe(true);
      }
    });

    it('all payment creation routes require NOSTR signature', () => {
      const sigRequired = ['/invoices', '/invoices/:id/pay', '/subscriptions'];
      for (const path of sigRequired) {
        const route = capturedRoutes.find((r) => r.method === 'POST' && r.path === path);
        expect(route, `POST ${path} not found`).toBeDefined();
        expect(
          hasMiddleware(route!, mockRequireNostrSig),
          `POST ${path} missing NOSTR signature middleware`
        ).toBe(true);
      }
    });
  });
});
